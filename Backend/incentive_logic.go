package backend

import (
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"

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

func CalculatePayout(calc IncentiveCalculator, val float64, subPeriod string) float64 {
	var rules IncentiveRules
	if calc.RulesJSON != "" {
		if err := json.Unmarshal([]byte(calc.RulesJSON), &rules); err != nil {
			log.Printf("CalculatePayout: failed to parse RulesJSON for calculator %s: %v", calc.Type, err)
			return 0
		}
	}

	if calc.Type == IncentiveTypeAchievement {
		tiers := rules.AchievementTiers
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
				payout = rate
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

func (r *IncentiveRules) IsUserEligible(u User) bool {
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

func ProcessIncentiveCalculation(db *gorm.DB, projectID uint, month string) ([]IncentiveResult, error) {
	var project IncentiveProject
	if err := db.Preload("Calculators").First(&project, projectID).Error; err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}

	// Fetch all users
	var allUsers []User
	db.Find(&allUsers)

	// Fetch orders for the month
	var orders []Order
	startDate := month + "-01T00:00:00Z"
	endDate := month + "-31T23:59:59Z"
	parts := strings.Split(month, "-")
	if len(parts) == 2 {
		year, _ := strconv.Atoi(parts[0])
		m, _ := strconv.Atoi(parts[1])
		firstDay := time.Date(year, time.Month(m), 1, 0, 0, 0, 0, time.UTC)
		lastDay := firstDay.AddDate(0, 1, -1)
		endDate = lastDay.Format("2006-01-02") + "T23:59:59Z"
	}
	db.Where("fulfillment_status = ? AND timestamp >= ? AND timestamp <= ?", "Delivered", startDate, endDate).Find(&orders)

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

	for _, o := range orders {
		userOrders[o.User]++
		userRevenue[o.User] += o.GrandTotal
		orderProfit := o.GrandTotal - o.TotalProductCost - o.InternalCost
		userProfit[o.User] += orderProfit
	}

	userSet := make(map[string]bool, len(allUsers))
	for _, u := range allUsers {
		userSet[u.UserName] = true
	}

	// Process each active calculator
	for _, calc := range project.Calculators {
		if calc.Status == "Disable" {
			continue
		}

		var rules IncentiveRules
		if calc.RulesJSON != "" {
			if err := json.Unmarshal([]byte(calc.RulesJSON), &rules); err != nil {
				log.Printf("ProcessIncentiveCalculation: failed to parse RulesJSON for calculator %d: %v", calc.ID, err)
				continue
			}
		}

		eligibleUsers := []User{}
		for _, u := range allUsers {
			if rules.IsUserEligible(u) {
				eligibleUsers = append(eligibleUsers, u)
			}
		}

		if len(eligibleUsers) == 0 {
			continue
		}

		metricType := rules.MetricType
		if metricType == "" {
			metricType = MetricSalesAmount
		}

		// Pre-calculate member counts for teams to distribute team manual data
		teamMemberCount := make(map[string]int)
		for _, u := range eligibleUsers {
			if u.Team != "" {
				userTeams := strings.Split(u.Team, ",")
				for _, ut := range userTeams {
					teamName := NormalizeTeamKey(ut)
					if teamName != "" {
						teamMemberCount[teamName]++
					}
				}
			}
		}

		userManualPerf := make(map[string]float64)
		teamManualPerf := make(map[string]float64)
		for _, md := range manualData {
			if md.MetricType == metricType {
				_, targetRaw, ok := ParseManualDataKey(md.DataKey)
				if !ok {
					continue
				}
				targetType, targetID := ResolveManualTarget(targetRaw, userSet)
				if targetType == "user" {
					userManualPerf[targetID] += md.Value
				} else {
					teamManualPerf[targetID] += md.Value
				}
			}
		}

		perfMap := make(map[string]float64)
		for _, u := range eligibleUsers {
			var baseVal float64
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

			val := baseVal + userManualPerf[u.UserName]

			if rules.DistributionRule.Method == "" || rules.DistributionRule.Method == DistIndividual {
				if u.Team != "" {
					userTeams := strings.Split(u.Team, ",")
					for _, ut := range userTeams {
						teamName := NormalizeTeamKey(ut)
						if teamName != "" && teamManualPerf[teamName] > 0 && teamMemberCount[teamName] > 0 {
							val += teamManualPerf[teamName] / float64(teamMemberCount[teamName])
						}
					}
				}
			}
			perfMap[u.UserName] = val
		}

		distMethod := rules.DistributionRule.Method
		if distMethod == "" {
			distMethod = DistIndividual
		}

		if distMethod == DistEqualSplit || distMethod == DistPercentageAllocation {
			var groupTotalPerf float64
			for _, v := range perfMap {
				groupTotalPerf += v
			}
			for teamID, teamVal := range teamManualPerf {
				if teamMemberCount[teamID] > 0 {
					groupTotalPerf += teamVal
				}
			}

			poolReward := CalculatePayout(calc, groupTotalPerf, "")

			if distMethod == DistEqualSplit {
				share := poolReward / float64(len(eligibleUsers))
				for _, u := range eligibleUsers {
					userRewards[u.UserName] += share
					userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
						CalculatorID:   calc.ID,
						CalculatorName: calc.Name,
						MetricValue:    groupTotalPerf, // Group metric
						Amount:         share,
						Description:    fmt.Sprintf("Equal split of group pool (Total Perf: %.2f)", groupTotalPerf),
					})
				}
			} else if distMethod == DistPercentageAllocation {
				for _, u := range eligibleUsers {
					for _, alloc := range rules.DistributionRule.Allocations {
						if alloc.MemberRoleOrName == u.UserName || alloc.MemberRoleOrName == u.Role {
							share := poolReward * (alloc.Percentage / 100.0)
							userRewards[u.UserName] += share
							userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
								CalculatorID:   calc.ID,
								CalculatorName: calc.Name,
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
			for _, u := range eligibleUsers {
				share := CalculatePayout(calc, perfMap[u.UserName], "")
				userRewards[u.UserName] += share
				userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
					CalculatorID:   calc.ID,
					CalculatorName: calc.Name,
					MetricValue:    perfMap[u.UserName],
					Amount:         share,
					Description:    fmt.Sprintf("Individual performance (Value: %.2f)", perfMap[u.UserName]),
				})
			}
		}
	}

	var results []IncentiveResult
	uniqueUsers := make(map[string]bool)
	for u := range userRewards { uniqueUsers[u] = true }
	for u := range userOrders { uniqueUsers[u] = true }
	for u := range userRevenue { uniqueUsers[u] = true }
	for u := range userProfit { uniqueUsers[u] = true }

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
