package backend

import (
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// Constants for Incentive Types
const (
	IncentiveTypeAchievement = "Achievement"
	IncentiveTypeCommission  = "Commission"
)

// Constants for Commission Conditions
const (
	ConditionOnTotalSales   = "On Total Sales"
	ConditionAboveTarget    = "Above Target"
	ConditionPerTransaction = "Per Transaction"
)

// Constants for Reward Types
const (
	RewardTypeFixed      = "Fixed Cash"
	RewardTypePercentage = "Percentage"
)

// Constants for Distribution Methods
const (
	DistIndividual           = "Individual"
	DistEqualSplit           = "Equal Split"
	DistPercentageAllocation = "Percentage Allocation"
)

// Constants for Metric Types
const (
	MetricSalesAmount = "Sales Amount"
	MetricRevenue     = "Revenue"
	MetricProfit      = "Profit"
	MetricOrderCount  = "Number of Orders"
)

// PayoutResult represents the result of a single calculation breakdown
// (Moved to models.go)

func ParseManualDataKey(dataKey string) (string, string, bool) {
	parts := strings.SplitN(strings.TrimSpace(dataKey), "_", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	period := strings.TrimSpace(parts[0])
	target := strings.TrimSpace(parts[1])
	if period == "" || target == "" {
		return "", "", false
	}
	return period, target, true
}

func NormalizeTeamKey(team string) string {
	return strings.ToLower(strings.TrimSpace(team))
}

func ResolveManualTarget(targetRaw string, userSet map[string]bool) (targetType string, targetID string) {
	target := strings.TrimSpace(targetRaw)
	lower := strings.ToLower(target)

	if strings.HasPrefix(lower, "user:") {
		return "user", strings.TrimSpace(target[len("user:"):])
	}
	if strings.HasPrefix(lower, "team:") {
		return "team", NormalizeTeamKey(target[len("team:"):])
	}
	if strings.HasPrefix(lower, "user_") {
		return "user", strings.TrimSpace(target[len("user_"):])
	}
	if strings.HasPrefix(lower, "team_") {
		return "team", NormalizeTeamKey(target[len("team_"):])
	}
	if userSet[target] {
		return "user", target
	}
	return "team", NormalizeTeamKey(target)
}

func CalculatePayout(calc IncentiveCalculator, val float64, subPeriod string, marathonValues map[string]float64) float64 {
	var rules IncentiveRules
	if calc.RulesJSON != "" {
		if err := json.Unmarshal([]byte(calc.RulesJSON), &rules); err != nil {
			log.Printf("CalculatePayout: failed to parse RulesJSON for calculator %s: %v", calc.Type, err)
			return 0
		}
	}

	if calc.Type == IncentiveTypeAchievement {
		tiers := rules.AchievementTiers

		// Marathon logic: Sum highest reward achieved in EACH unique sub-period
		if rules.IsMarathon && subPeriod == "" {
			subPeriodRewards := make(map[string]float64)
			const defaultSubGroup = "_default_"

			// If we have specific values per sub-period (Manual Data)
			if len(marathonValues) > 0 {
				for sp, spVal := range marathonValues {
					maxReward := 0.0
					for _, t := range tiers {
						// Match tier to this sub-period or default
						if t.SubPeriod == sp || (t.SubPeriod == "" && sp == defaultSubGroup) {
							if spVal >= t.Target {
								reward := t.RewardAmount
								if t.RewardType == RewardTypePercentage {
									reward = spVal * (t.RewardAmount / 100.0)
								}
								if reward > maxReward {
									maxReward = reward
								}
							}
						}
					}
					subPeriodRewards[sp] = maxReward
				}
			} else {
				// Fallback to legacy behavior if no sub-period breakdown (System Data)
				for _, t := range tiers {
					if val >= t.Target {
						reward := t.RewardAmount
						if t.RewardType == RewardTypePercentage {
							reward = val * (t.RewardAmount / 100.0)
						}

						spKey := t.SubPeriod
						if spKey == "" {
							spKey = defaultSubGroup
						}

						if reward > subPeriodRewards[spKey] {
							subPeriodRewards[spKey] = reward
						}
					}
				}
			}

			var total float64
			for _, r := range subPeriodRewards {
				total += r
			}
			return total
		}

		// Normal logic or specific sub-period calculation
		var activeTiers []IncentiveTier
		for _, t := range tiers {
			if subPeriod == "" || t.SubPeriod == "" || t.SubPeriod == subPeriod {
				activeTiers = append(activeTiers, t)
			}
		}
		sort.Slice(activeTiers, func(i, j int) bool {
			return activeTiers[i].Target > activeTiers[j].Target
		})
		for _, t := range activeTiers {
			if val >= t.Target {
				if t.RewardType == RewardTypePercentage {
					return val * (t.RewardAmount / 100.0)
				}
				return t.RewardAmount
			}
		}
		return 0
	}

	if calc.Type == IncentiveTypeCommission {
		method := rules.CommissionMethod
		condition := rules.CommissionCondition
		rate := rules.CommissionRate

		if rules.MinSalesRequired > 0 && val < rules.MinSalesRequired {
			return 0
		}

		var payout float64
		if rules.CommissionType == "Tiered Commission" {
			for _, t := range rules.CommissionTiers {
				if val >= t.From && (t.To == nil || val <= *t.To) {
					if method == RewardTypePercentage {
						payout = val * (t.Rate / 100.0)
					} else {
						payout = t.Rate
					}
					break
				}
			}
		} else if condition == ConditionAboveTarget {
			target := rules.TargetAmount
			if val > target {
				diff := val - target
				if method == RewardTypePercentage {
					payout = diff * (rate / 100.0)
				} else {
					payout = rate
				}
			}
		} else if condition == ConditionPerTransaction {
			if method == RewardTypePercentage {
				payout = val * (rate / 100.0)
			} else {
				payout = val * rate
			}
		} else {
			// Default: On Total Sales
			if method == RewardTypePercentage {
				payout = val * (rate / 100.0)
			} else {
				payout = rate
			}
		}

		if rules.MaxCommissionCap > 0 && payout > rules.MaxCommissionCap {
			payout = rules.MaxCommissionCap
		}
		return payout
	}

	return 0
}

func (r *IncentiveRules) IsIncluded(u User) bool {
	if len(r.ApplyTo) == 0 {
		return true
	}
	for _, target := range r.ApplyTo {
		if strings.HasPrefix(target, "Role:") && u.Role == strings.TrimPrefix(target, "Role:") {
			return true
		}
		if strings.HasPrefix(target, "Team:") {
			targetTeam := strings.TrimPrefix(target, "Team:")
			userTeams := strings.Split(u.Team, ",")
			for _, ut := range userTeams {
				if strings.EqualFold(strings.TrimSpace(ut), strings.TrimSpace(targetTeam)) {
					return true
				}
			}
		}
		if strings.HasPrefix(target, "User:") && u.UserName == strings.TrimPrefix(target, "User:") {
			return true
		}
	}
	return false
}

func (r *IncentiveRules) IsExcluded(u User) bool {
	for _, target := range r.ExcludeTargets {
		if strings.HasPrefix(target, "Role:") && u.Role == strings.TrimPrefix(target, "Role:") {
			return true
		}
		if strings.HasPrefix(target, "User:") && u.UserName == strings.TrimPrefix(target, "User:") {
			return true
		}
		if target == u.UserName {
			return true
		}
	}
	return false
}

func (r *IncentiveRules) IsUserEligible(u User) bool {
	return r.IsIncluded(u) && !r.IsExcluded(u)
}

func ProcessIncentiveCalculation(db *gorm.DB, projectID uint, month string) ([]IncentiveResult, error) {
	var project IncentiveProject
	if err := db.Preload("Calculators").First(&project, projectID).Error; err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	// Fetch all users
	var allUsers []User
	db.Find(&allUsers)

	// Fetch orders for the month. Timestamps in this app are stored as strings and
	// may be either "YYYY-MM-DD HH:mm:ss" or RFC3339, so filter by the stable month prefix.
	var orders []Order
	db.Where("fulfillment_status = ? AND substr(timestamp, 1, 7) = ?", "Delivered", month).Find(&orders)

	// Fetch Manual Data
	var manualData []IncentiveManualData
	db.Where("project_id = ? AND month = ?", projectID, month).Find(&manualData)

	// Custom Payouts
	var customPayouts []IncentiveCustomPayout
	db.Where("project_id = ? AND month = ?", projectID, month).Find(&customPayouts)
	customPayoutMap := make(map[string]float64)
	for _, cp := range customPayouts {
		customPayoutMap[cp.UserName] = cp.Value
	}

	// Group results by User
	userRewards := make(map[string]float64)
	userOrders := make(map[string]int)
	userRevenue := make(map[string]float64)
	userProfit := make(map[string]float64)
	userBreakdown := make(map[string][]PayoutResult)

	ds := strings.ToLower(strings.TrimSpace(project.DataSource))
	isManualProject := strings.Contains(ds, "manual")

	if isManualProject {
		// Strictly clear system data maps for manual projects
		userOrders = make(map[string]int)
		userRevenue = make(map[string]float64)
		userProfit = make(map[string]float64)
	} else {
		for _, o := range orders {
			userOrders[o.User]++
			userRevenue[o.User] += o.GrandTotal
			orderProfit := o.GrandTotal - o.TotalProductCost - o.InternalCost
			userProfit[o.User] += orderProfit
		}
	}

	userSet := make(map[string]bool, len(allUsers))
	for _, u := range allUsers {
		userSet[u.UserName] = true
	}

	// Process each active calculator
	for _, calc := range project.Calculators {
		var rules IncentiveRules
		if calc.RulesJSON != "" {
			if err := json.Unmarshal([]byte(calc.RulesJSON), &rules); err != nil {
				log.Printf("ProcessIncentiveCalculation: failed to parse RulesJSON for calculator %d: %v", calc.ID, err)
				continue
			}
		}

		status := strings.TrimSpace(calc.Status)
		if status == "" {
			status = strings.TrimSpace(rules.Status)
		}
		if strings.EqualFold(status, "Disable") || strings.EqualFold(status, "Draft") {
			continue
		}

		// 3. Find targeted users (Potential contributors)
		var targetedUsers []User
		teamMemberCount := make(map[string]int)
		for _, u := range allUsers {
			if rules.IsIncluded(u) {
				targetedUsers = append(targetedUsers, u)
				if u.Team != "" {
					userTeams := strings.Split(u.Team, ",")
					for _, ut := range userTeams {
						teamName := NormalizeTeamKey(ut)
						if teamName != "" {
							// For member count (used for division), only count those who can actually RECEIVE money
							if !rules.IsExcluded(u) {
								teamMemberCount[teamName]++
							}
						}
					}
				}
			}
		}

		if len(targetedUsers) == 0 {
			continue
		}

		metricType := rules.MetricType
		if metricType == "" {
			metricType = MetricSalesAmount
		}

		userManualPerf := make(map[string]float64)
		teamManualPerf := make(map[string]float64)
		userManualSubPerf := make(map[string]map[string]float64) // user -> subperiod -> value
		teamManualSubPerf := make(map[string]map[string]float64) // team -> subperiod -> value

		for _, md := range manualData {
			// Normalize metric types for comparison
			mdMetric := strings.ToLower(strings.TrimSpace(md.MetricType))
			calcMetric := strings.ToLower(strings.TrimSpace(metricType))
			
			if mdMetric == calcMetric || 
			   (mdMetric == "revenue" && calcMetric == "sales amount") ||
			   (mdMetric == "sales amount" && calcMetric == "revenue") {
				period, targetRaw, ok := ParseManualDataKey(md.DataKey)
				if !ok {
					continue
				}
				targetType, targetID := ResolveManualTarget(targetRaw, userSet)
				if targetType == "user" {
					userManualPerf[targetID] += md.Value
					if userManualSubPerf[targetID] == nil {
						userManualSubPerf[targetID] = make(map[string]float64)
					}
					userManualSubPerf[targetID][period] += md.Value
				} else {
					teamManualPerf[targetID] += md.Value
					if teamManualSubPerf[targetID] == nil {
						teamManualSubPerf[targetID] = make(map[string]float64)
					}
					teamManualSubPerf[targetID][period] += md.Value
				}
			}
		}

		perfMap := make(map[string]float64)
		userSubPerfMap := make(map[string]map[string]float64) // For Marathon

		for _, u := range targetedUsers {
			var baseVal float64
			if !isManualProject {
				mType := strings.ToLower(strings.TrimSpace(metricType))
				switch mType {
				case "sales amount", "revenue":
					baseVal = userRevenue[u.UserName]
				case "profit":
					baseVal = userProfit[u.UserName]
				case "orders", "order count", "number of orders":
					baseVal = float64(userOrders[u.UserName])
				default:
					baseVal = float64(userOrders[u.UserName])
				}
			}

			val := baseVal + userManualPerf[u.UserName]
			
			// Track sub-period breakdown for Marathon
			subMap := make(map[string]float64)
			// Add user's own manual sub-period data
			for sp, spVal := range userManualSubPerf[u.UserName] {
				subMap[sp] += spVal
			}

			if u.Team != "" {
				userTeams := strings.Split(u.Team, ",")
				for _, ut := range userTeams {
					teamName := NormalizeTeamKey(ut)
					if teamName != "" {
						// Distribute aggregate team manual data (Shared among eligible recipients)
						if teamManualPerf[teamName] > 0 && teamMemberCount[teamName] > 0 {
							val += teamManualPerf[teamName] / float64(teamMemberCount[teamName])
						}
						// Distribute team sub-period data (For Marathon)
						for sp, spVal := range teamManualSubPerf[teamName] {
							if spVal > 0 && teamMemberCount[teamName] > 0 {
								subMap[sp] += spVal / float64(teamMemberCount[teamName])
							}
						}
					}
				}
			}

			perfMap[u.UserName] = val
			userSubPerfMap[u.UserName] = subMap
		}

		distMethod := rules.DistributionRule.Method
		if distMethod == "" {
			distMethod = DistIndividual
		}

		if distMethod == DistEqualSplit || distMethod == DistPercentageAllocation {
			var groupTotalPerf float64
			groupSubPerfMap := make(map[string]float64)

			for _, u := range targetedUsers {
				groupTotalPerf += perfMap[u.UserName]
				for sp, spVal := range userSubPerfMap[u.UserName] {
					groupSubPerfMap[sp] += spVal
				}
			}

			// For group methods, calculate overall reward
			poolReward := CalculatePayout(calc, groupTotalPerf, "", groupSubPerfMap)

			if distMethod == DistEqualSplit {				// Count recipients
				eligibleCount := 0
				for _, u := range targetedUsers {
					if !rules.IsExcluded(u) { eligibleCount++ }
				}
				
				rewardPerPerson := 0.0
				if eligibleCount > 0 {
					rewardPerPerson = poolReward / float64(eligibleCount)
				}

				for _, u := range targetedUsers {
					if rules.IsExcluded(u) { continue }
					userRewards[u.UserName] += rewardPerPerson
					userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
						CalculatorID:   calc.ID,
						CalculatorName: calc.Name,
						MetricType:     metricType,
						MetricValue:    groupTotalPerf, // Group metric
						Amount:         rewardPerPerson,
						Description:    fmt.Sprintf("Equal split of group pool among %d members (Total Perf: %.2f)", eligibleCount, groupTotalPerf),
					})
				}
			} else if distMethod == DistPercentageAllocation {
				for _, u := range targetedUsers {
					if rules.IsExcluded(u) { continue }
					for _, alloc := range rules.DistributionRule.Allocations {
						if alloc.MemberRoleOrName == u.UserName || alloc.MemberRoleOrName == u.Role {
							share := poolReward * (alloc.Percentage / 100.0)
							userRewards[u.UserName] += share
							userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
								CalculatorID:   calc.ID,
								CalculatorName: calc.Name,
								MetricType:     metricType,
								MetricValue:    groupTotalPerf,
								Amount:         share,
								Description:    fmt.Sprintf("%.1f%% allocation of group pool (Total Perf: %.2f)", alloc.Percentage, groupTotalPerf),
							})
							break
						}
					}
				}
			}
		} else {
			for _, u := range targetedUsers {
				if rules.IsExcluded(u) { continue }
				share := CalculatePayout(calc, perfMap[u.UserName], "", userSubPerfMap[u.UserName])
				userRewards[u.UserName] += share
				
				// Build detailed description for manual data & distribution
				desc := fmt.Sprintf("Individual performance (Total: %.2f)", perfMap[u.UserName])
				if isManualProject {
					personal := userManualPerf[u.UserName]
					fromTeam := perfMap[u.UserName] - personal
					if fromTeam > 0 {
						desc = fmt.Sprintf("Personal: %.2f | Team Dist: %.2f (Total: %.2f)", personal, fromTeam, perfMap[u.UserName])
					} else {
						desc = fmt.Sprintf("Manual Entry: %.2f", personal)
					}
				}

				userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
					CalculatorID:   calc.ID,
					CalculatorName: calc.Name,
					MetricType:     metricType,
					MetricValue:    perfMap[u.UserName],
					Amount:         share,
					Description:    desc,
				})
			}
		}

		// Update performance display values in IncentiveResult
		// If manual project, we want these fields to reflect the manual data used for calculation
		if isManualProject {
			mType := strings.ToLower(strings.TrimSpace(metricType))
			for _, u := range targetedUsers {
				uName := u.UserName
				val := perfMap[uName] // This val now includes distributed team data
				switch mType {
				case "sales amount", "revenue":
					if val > userRevenue[uName] {
						userRevenue[uName] = val
					}
				case "profit":
					if val > userProfit[uName] {
						userProfit[uName] = val
					}
				case "orders", "order count", "number of orders":
					if int(val) > userOrders[uName] {
						userOrders[uName] = int(val)
					}
				default:
					// Default to orders if unknown
					if int(val) > userOrders[uName] {
						userOrders[uName] = int(val)
					}
				}
			}
		}
	}

	var results []IncentiveResult
	uniqueUsers := make(map[string]bool)
	for u := range userRewards {
		uniqueUsers[u] = true
	}
	for u := range userOrders {
		uniqueUsers[u] = true
	}
	for u := range userRevenue {
		uniqueUsers[u] = true
	}
	for u := range userProfit {
		uniqueUsers[u] = true
	}

	for user := range uniqueUsers {
		payout := userRewards[user]
		isCustom := false
		if customVal, exists := customPayoutMap[user]; exists {
			payout = customVal
			isCustom = true
		}

		breakdownJSON, _ := json.Marshal(userBreakdown[user])

		results = append(results, IncentiveResult{
			ProjectID:       projectID,
			UserName:        user,
			TotalOrders:     userOrders[user],
			TotalRevenue:    userRevenue[user],
			TotalProfit:     userProfit[user],
			CalculatedValue: payout,
			IsCustom:        isCustom,
			BreakdownJSON:   string(breakdownJSON),
		})
	}

	return results, nil
}
