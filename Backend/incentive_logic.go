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

func CalculatePayout(calc IncentiveCalculator, val float64, subPeriod string, marathonValues map[string]float64, faceVideosValues map[string]float64) float64 {
	var rules IncentiveRules
	if calc.RulesJSON != "" {
		if err := json.Unmarshal([]byte(calc.RulesJSON), &rules); err != nil {
			log.Printf("CalculatePayout: failed to parse RulesJSON for calculator %s: %v", calc.Type, err)
			return 0
		}
	}

	if calc.Type == IncentiveTypeAchievement {
		metricTypeLower := strings.ToLower(strings.TrimSpace(rules.MetricType))
		if metricTypeLower == "face-showing videos" {
			// Face-showing videos are calculated as part of the total videos calculator, so return 0 payout here
			return 0.0
		}
		if metricTypeLower == "number of videos" || metricTypeLower == "videos" {
			// Custom Video Logic (dynamically read from AchievementTiers if configured)
			tiers := rules.AchievementTiers
			if len(tiers) == 0 {
				tiers = []IncentiveTier{
					{Target: 10, RewardAmount: 5, FaceTarget: 0},
					{Target: 15, RewardAmount: 10, FaceTarget: 0},
					{Target: 15, RewardAmount: 15, FaceTarget: 5},
				}
			}

			if (rules.IsMarathon || strings.EqualFold(rules.CalculationPeriod, "weekly")) && subPeriod == "" {
				var total float64
				for sp, totalVideos := range marathonValues {
					faceVideos := faceVideosValues[sp]
					var maxReward float64
					for _, tier := range tiers {
						if totalVideos >= tier.Target {
							if tier.FaceTarget <= 0 || faceVideos >= tier.FaceTarget {
								if tier.RewardAmount > maxReward {
									maxReward = tier.RewardAmount
								}
							}
						}
					}
					total += maxReward
				}
				return total
			}

			// Single period or fallback logic
			faceVideos := faceVideosValues[subPeriod]
			var maxReward float64
			for _, tier := range tiers {
				if val >= tier.Target {
					if tier.FaceTarget <= 0 || faceVideos >= tier.FaceTarget {
						if tier.RewardAmount > maxReward {
							maxReward = tier.RewardAmount
						}
					}
				}
			}
			return maxReward
		}

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
						// Match tier to this sub-period or default (empty SubPeriod matches all sub-periods)
						if t.SubPeriod == sp || t.SubPeriod == "" {
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
		lowerTarget := strings.ToLower(target)
		if strings.HasPrefix(lowerTarget, "role:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.Role), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.HasPrefix(lowerTarget, "team:") {
			targetTeam := target[5:]
			userTeams := strings.Split(u.Team, ",")
			for _, ut := range userTeams {
				if strings.EqualFold(strings.TrimSpace(ut), strings.TrimSpace(targetTeam)) {
					return true
				}
			}
		}
		if strings.HasPrefix(lowerTarget, "user:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(val)) {
				return true
			}
		}
	}
	return false
}

func (r *IncentiveRules) IsExcludedForTeam(u User, teamName string) bool {
	normalizedTeamName := NormalizeTeamKey(teamName)
	for _, target := range r.ExcludeTargets {
		lowerTarget := strings.ToLower(target)
		if strings.HasPrefix(lowerTarget, "role:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.Role), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.HasPrefix(lowerTarget, "team:") {
			targetTeam := target[5:]
			userTeams := strings.Split(u.Team, ",")
			for _, ut := range userTeams {
				if strings.EqualFold(strings.TrimSpace(ut), strings.TrimSpace(targetTeam)) {
					return true
				}
			}
		}
		if strings.HasPrefix(lowerTarget, "user:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.HasPrefix(lowerTarget, "teamuser:") {
			parts := strings.SplitN(target[9:], ":", 2)
			if len(parts) == 2 {
				tgtTeam := NormalizeTeamKey(parts[0])
				tgtUser := parts[1]
				if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(tgtUser)) && normalizedTeamName == tgtTeam {
					return true
				}
			}
		}
		if strings.EqualFold(strings.TrimSpace(target), strings.TrimSpace(u.UserName)) {
			return true
		}
	}
	return false
}

func (r *IncentiveRules) IsExcludedForTeamIndividually(u User, teamName string) bool {
	normalizedTeamName := NormalizeTeamKey(teamName)
	for _, target := range r.ExcludeTargets {
		lowerTarget := strings.ToLower(target)
		if strings.HasPrefix(lowerTarget, "role:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.Role), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.HasPrefix(lowerTarget, "user:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.HasPrefix(lowerTarget, "teamuser:") {
			parts := strings.SplitN(target[9:], ":", 2)
			if len(parts) == 2 {
				tgtTeam := NormalizeTeamKey(parts[0])
				tgtUser := parts[1]
				if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(tgtUser)) && normalizedTeamName == tgtTeam {
					return true
				}
			}
		}
		if strings.EqualFold(strings.TrimSpace(target), strings.TrimSpace(u.UserName)) {
			return true
		}
	}
	return false
}

func (r *IncentiveRules) IsExcluded(u User) bool {
	for _, target := range r.ExcludeTargets {
		lowerTarget := strings.ToLower(target)
		if strings.HasPrefix(lowerTarget, "role:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.Role), strings.TrimSpace(val)) {
				return true
			}
		}
		// Note: We do NOT check "team:" exclusions here. Excluding a team excludes the team
		// as a collective calculation unit, but does not exclude its members from individual calculations.
		if strings.HasPrefix(lowerTarget, "user:") {
			val := target[5:]
			if strings.EqualFold(strings.TrimSpace(u.UserName), strings.TrimSpace(val)) {
				return true
			}
		}
		if strings.EqualFold(strings.TrimSpace(target), strings.TrimSpace(u.UserName)) {
			return true
		}
	}
	return false
}

func (r *IncentiveRules) IsUserEligible(u User) bool {
	return r.IsIncluded(u) && !r.IsExcluded(u)
}

func (r *IncentiveRules) IsTeamApplicable(teamName string) bool {
	hasTeamFilters := false
	for _, target := range r.ApplyTo {
		if strings.HasPrefix(strings.ToLower(target), "team:") {
			hasTeamFilters = true
			break
		}
	}
	if !hasTeamFilters {
		return true
	}
	normalizedTeamName := NormalizeTeamKey(teamName)
	for _, target := range r.ApplyTo {
		lowerTarget := strings.ToLower(target)
		if strings.HasPrefix(lowerTarget, "team:") {
			targetTeam := NormalizeTeamKey(target[5:])
			if normalizedTeamName == targetTeam {
				return true
			}
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
	for _, u := range allUsers {
		log.Printf("[DEBUG] User list: Username=%q, FullName=%q, Team=%q, Role=%q", u.UserName, u.FullName, u.Team, u.Role)
	}

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

	// Pre-build map of face-showing videos: username -> subperiod -> value
	faceVideosSubPerf := make(map[string]map[string]float64)
	for _, md := range manualData {
		mdMetric := strings.ToLower(strings.TrimSpace(md.MetricType))
		if mdMetric == "face-showing videos" {
			period, targetRaw, ok := ParseManualDataKey(md.DataKey)
			if ok {
				targetType, targetID := ResolveManualTarget(targetRaw, userSet)
				if targetType == "user" {
					if faceVideosSubPerf[targetID] == nil {
						faceVideosSubPerf[targetID] = make(map[string]float64)
					}
					faceVideosSubPerf[targetID][period] += md.Value
				}
			}
		}
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
		log.Printf("[DEBUG] Calculator %d: Name=%q, RulesJSON=%s, Parsed ApplyTo=%v, Parsed ExcludeTargets=%v", calc.ID, calc.Name, calc.RulesJSON, rules.ApplyTo, rules.ExcludeTargets)

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
							// For member count (used for division), only count those who can actually RECEIVE money in applicable teams
							if rules.IsTeamApplicable(teamName) && !rules.IsExcludedForTeam(u, teamName) {
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
					if userManualSubPerf[targetID] == nil {
						userManualSubPerf[targetID] = make(map[string]float64)
					}
					userManualSubPerf[targetID][period] += md.Value
				} else {
					if teamManualSubPerf[targetID] == nil {
						teamManualSubPerf[targetID] = make(map[string]float64)
					}
					teamManualSubPerf[targetID][period] += md.Value
				}
			}
		}

		// Calculate total manual performance based on Marathon status
		if rules.IsMarathon {
			for targetID, subMap := range userManualSubPerf {
				maxVal := 0.0
				for _, val := range subMap {
					if val > maxVal {
						maxVal = val
					}
				}
				userManualPerf[targetID] = maxVal
			}
			for targetID, subMap := range teamManualSubPerf {
				maxVal := 0.0
				for _, val := range subMap {
					if val > maxVal {
						maxVal = val
					}
				}
				teamManualPerf[targetID] = maxVal
			}
		} else {
			for targetID, subMap := range userManualSubPerf {
				sumVal := 0.0
				for _, val := range subMap {
					sumVal += val
				}
				userManualPerf[targetID] = sumVal
			}
			for targetID, subMap := range teamManualSubPerf {
				sumVal := 0.0
				for _, val := range subMap {
					sumVal += val
				}
				teamManualPerf[targetID] = sumVal
			}
		}

		// Track individual vs team performance components to prevent leaks during aggregation
		individualPerfMap := make(map[string]float64)
		individualSubPerfMap := make(map[string]map[string]float64)

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

			// Individual total = system data + individual manual entry
			individualPerfMap[u.UserName] = baseVal + userManualPerf[u.UserName]
			
			// Individual sub-period = individual manual entry breakdown
			subMap := make(map[string]float64)
			for sp, spVal := range userManualSubPerf[u.UserName] {
				subMap[sp] += spVal
			}
			individualSubPerfMap[u.UserName] = subMap
		}

		// Pre-calculate full user profiles (including distributed team data) for display and individual rules
		fullPerfMap := make(map[string]float64)
		fullSubPerfMap := make(map[string]map[string]float64)

		for _, u := range targetedUsers {
			val := individualPerfMap[u.UserName]
			subMap := make(map[string]float64)
			for sp, spVal := range individualSubPerfMap[u.UserName] {
				subMap[sp] = spVal
			}

			if u.Team != "" {
				userTeams := strings.Split(u.Team, ",")
				for _, ut := range userTeams {
					teamName := NormalizeTeamKey(ut)
					if teamName != "" {
						if rules.IsTeamApplicable(teamName) && !rules.IsExcludedForTeam(u, teamName) {
							if teamManualPerf[teamName] > 0 && teamMemberCount[teamName] > 0 {
								val += teamManualPerf[teamName] / float64(teamMemberCount[teamName])
							}
							for sp, spVal := range teamManualSubPerf[teamName] {
								if spVal > 0 && teamMemberCount[teamName] > 0 {
									subMap[sp] += spVal / float64(teamMemberCount[teamName])
								}
							}
						}
					}
				}
			}
			fullPerfMap[u.UserName] = val
			fullSubPerfMap[u.UserName] = subMap
		}

		distMethod := rules.DistributionRule.Method
		if distMethod == "" {
			distMethod = DistIndividual
		}

		if distMethod == DistEqualSplit || distMethod == DistPercentageAllocation {
			// Group users by team to ensure rewards are not pooled across different teams
			teamToUsers := make(map[string][]User)
			for _, u := range targetedUsers {
				if u.Team == "" {
					teamToUsers["_unassigned_"] = append(teamToUsers["_unassigned_"], u)
					continue
				}
				teams := strings.Split(u.Team, ",")
				for _, t := range teams {
					tName := NormalizeTeamKey(t)
					if tName != "" {
						teamToUsers[tName] = append(teamToUsers[tName], u)
					}
				}
			}

			for teamName, groupUsers := range teamToUsers {
				if !rules.IsTeamApplicable(teamName) {
					continue
				}
				// CALCULATE TEAM ACHIEVEMENT:
				// Team Achievement = Sum(Members' Individual Base) + Team's Shared Data
				// We DO NOT sum members' full profiles because that would leak data from their OTHER teams.
				
				var groupTotalPerf float64
				groupSubPerfMap := make(map[string]float64)

				for _, u := range groupUsers {
					if !rules.IsExcludedForTeam(u, teamName) {
						groupTotalPerf += individualPerfMap[u.UserName]
						for sp, spVal := range individualSubPerfMap[u.UserName] {
							groupSubPerfMap[sp] += spVal
						}
					}
				}
				
				// Add the collective manual data for THIS team exactly once
				if teamName != "_unassigned_" {
					groupTotalPerf += teamManualPerf[teamName]
					for sp, spVal := range teamManualSubPerf[teamName] {
						groupSubPerfMap[sp] += spVal
					}
				}

				// Set display performance for team members to team's total performance (not divided)
				mType := strings.ToLower(strings.TrimSpace(metricType))
				for _, u := range groupUsers {
					if !rules.IsExcludedForTeam(u, teamName) {
						switch mType {
						case "sales amount", "revenue":
							if groupTotalPerf > userRevenue[u.UserName] {
								userRevenue[u.UserName] = groupTotalPerf
							}
						case "profit":
							if groupTotalPerf > userProfit[u.UserName] {
								userProfit[u.UserName] = groupTotalPerf
							}
						case "orders", "order count", "number of orders":
							if int(groupTotalPerf) > userOrders[u.UserName] {
								userOrders[u.UserName] = int(groupTotalPerf)
							}
						}
					}
				}

				// For group methods, calculate reward for this specific team group achievement
				poolReward := CalculatePayout(calc, groupTotalPerf, "", groupSubPerfMap, nil)
				if poolReward <= 0 {
					continue
				}

				if distMethod == DistEqualSplit {
					// Count recipients in this group
					eligibleCount := 0
					for _, u := range groupUsers {
						if !rules.IsExcludedForTeam(u, teamName) {
							eligibleCount++
						}
					}

					rewardPerPerson := 0.0
					if eligibleCount > 0 {
						rewardPerPerson = poolReward / float64(eligibleCount)
					}

					for _, u := range groupUsers {
						if rules.IsExcludedForTeam(u, teamName) {
							continue
						}
						userRewards[u.UserName] += rewardPerPerson
						userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
							CalculatorID:   calc.ID,
							CalculatorName: calc.Name,
							MetricType:     metricType,
							MetricValue:    groupTotalPerf, // Group metric
							Amount:         rewardPerPerson,
							Description:    fmt.Sprintf("Equal split of %s group pool among %d members (Total Perf: %.2f)", teamName, eligibleCount, groupTotalPerf),
						})
					}
				} else if distMethod == DistPercentageAllocation {
					for _, u := range groupUsers {
						if rules.IsExcludedForTeam(u, teamName) {
							continue
						}
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
									Description:    fmt.Sprintf("%.1f%% allocation of %s group pool (Total Perf: %.2f)", alloc.Percentage, teamName, groupTotalPerf),
								})
								break
							}
						}
					}
				}
			}
		} else {
			for _, u := range targetedUsers {
				if rules.IsExcluded(u) { continue }
				share := CalculatePayout(calc, fullPerfMap[u.UserName], "", fullSubPerfMap[u.UserName], faceVideosSubPerf[u.UserName])
				userRewards[u.UserName] += share
				
				// Build detailed description for manual data & distribution
				desc := fmt.Sprintf("Individual performance (Total: %.2f)", fullPerfMap[u.UserName])
				if isManualProject {
					personal := userManualPerf[u.UserName]
					fromTeam := fullPerfMap[u.UserName] - personal
					if fromTeam > 0 {
						desc = fmt.Sprintf("Personal: %.2f | Team Dist: %.2f (Total: %.2f)", personal, fromTeam, fullPerfMap[u.UserName])
					} else {
						desc = fmt.Sprintf("Manual Entry: %.2f", personal)
					}
				}

				userBreakdown[u.UserName] = append(userBreakdown[u.UserName], PayoutResult{
					CalculatorID:   calc.ID,
					CalculatorName: calc.Name,
					MetricType:     metricType,
					MetricValue:    fullPerfMap[u.UserName],
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
				// Only overwrite with individual/distributed manual performance if it's an individual calculator
				if distMethod != DistEqualSplit && distMethod != DistPercentageAllocation {
					val := fullPerfMap[uName]
					switch mType {
					case "sales amount", "revenue":
						if val > userRevenue[uName] {
							userRevenue[uName] = val
						}
					case "profit":
						if val > userProfit[uName] {
							userProfit[uName] = val
						}
					case "orders", "order count", "number of orders", "number of videos", "face-showing videos":
						if int(val) > userOrders[uName] {
							userOrders[uName] = int(val)
						}
					default:
						// Default fallback for any custom integer/count metrics
						if int(val) > userOrders[uName] {
							userOrders[uName] = int(val)
						}
					}
				}
			}
		}
	}

	userMap := make(map[string]User, len(allUsers))
	for _, u := range allUsers {
		userMap[u.UserName] = u
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
		userObj, exists := userMap[user]
		if !exists {
			continue
		}

		// Check if user is excluded from all calculators in this project
		isExcludedFromAll := true
		hasApplicableCalc := false
		for _, calc := range project.Calculators {
			var rules IncentiveRules
			if calc.RulesJSON != "" {
				json.Unmarshal([]byte(calc.RulesJSON), &rules)
			}
			if rules.IsIncluded(userObj) {
				hasApplicableCalc = true
				if !rules.IsExcluded(userObj) {
					// Check if they are excluded for all teams they belong to
					if userObj.Team != "" {
						userTeams := strings.Split(userObj.Team, ",")
						teamExcludedCount := 0
						applicableTeamCount := 0
						for _, ut := range userTeams {
							teamName := NormalizeTeamKey(ut)
							if teamName != "" && rules.IsTeamApplicable(teamName) {
								applicableTeamCount++
								if rules.IsExcludedForTeamIndividually(userObj, teamName) {
									teamExcludedCount++
								}
							}
						}
						if applicableTeamCount > 0 && teamExcludedCount < applicableTeamCount {
							isExcludedFromAll = false
						}
					} else {
						isExcludedFromAll = false
					}
				}
			}
		}

		if hasApplicableCalc && isExcludedFromAll {
			continue // Skip this user entirely from results as they are fully excluded
		}

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
