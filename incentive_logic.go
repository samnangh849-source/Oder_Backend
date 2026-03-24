package main

import (
	"encoding/json"
	"strings"
)

type IncentiveRules struct {
	Description         string           `json:"description"`
	ApplyTo             []string         `json:"applyTo"`
	MetricType          string           `json:"metricType"`
	MetricUnit          string           `json:"metricUnit"`
	CalculationPeriod   string           `json:"calculationPeriod"`
	ResetEveryPeriod    bool             `json:"resetEveryPeriod"`
	IsMarathon          bool             `json:"isMarathon"`
	AchievementTiers    []IncentiveTier  `json:"achievementTiers"`
	CommissionType      string           `json:"commissionType"`
	CommissionMethod    string           `json:"commissionMethod"`
	CommissionCondition string           `json:"commissionCondition"`
	CommissionRate      float64          `json:"commissionRate"`
	TargetAmount        float64          `json:"targetAmount"`
	CommissionTiers     []CommissionTier `json:"commissionTiers"`
	DistributionRule    struct {
		Method      string `json:"method"`
		Allocations []struct {
			MemberRoleOrName string  `json:"memberRoleOrName"`
			Percentage       float64 `json:"percentage"`
		} `json:"allocations"`
	} `json:"distributionRule"`
	MinSalesRequired float64 `json:"minSalesRequired"`
	MaxCommissionCap float64 `json:"maxCommissionCap"`
	RequireApproval  bool    `json:"requireApproval"`
	ExcludeRefunded  bool    `json:"excludeRefunded"`
	IncludeTax       bool    `json:"includeTax"`
}

type IncentiveTier struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Target       float64 `json:"target"`
	RewardAmount float64 `json:"rewardAmount"`
	RewardType   string  `json:"rewardType"`
	SubPeriod    string  `json:"subPeriod"`
}

type CommissionTier struct {
	From float64  `json:"from"`
	To   *float64 `json:"to"`
	Rate float64  `json:"rate"`
}

func parseManualDataKey(dataKey string) (string, string, bool) {
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

func normalizeTeamKey(team string) string {
	return strings.ToLower(strings.TrimSpace(team))
}

func resolveManualTarget(targetRaw string, userSet map[string]bool) (targetType string, targetID string) {
	target := strings.TrimSpace(targetRaw)
	lower := strings.ToLower(target)

	if strings.HasPrefix(lower, "user:") {
		return "user", strings.TrimSpace(target[len("user:"):])
	}
	if strings.HasPrefix(lower, "team:") {
		return "team", normalizeTeamKey(target[len("team:"):])
	}
	if strings.HasPrefix(lower, "user_") {
		return "user", strings.TrimSpace(target[len("user_"):])
	}
	if strings.HasPrefix(lower, "team_") {
		return "team", normalizeTeamKey(target[len("team_"):])
	}
	if userSet[target] {
		return "user", target
	}
	return "team", normalizeTeamKey(target)
}

func calculatePayout(calc IncentiveCalculator, val float64, subPeriod string) float64 {
	var rules IncentiveRules
	if calc.RulesJSON != "" {
		json.Unmarshal([]byte(calc.RulesJSON), &rules)
	}

	if calc.Type == "Achievement" {
		tiers := rules.AchievementTiers
		var activeTiers []IncentiveTier
		for _, t := range tiers {
			if subPeriod == "" || t.SubPeriod == "" || t.SubPeriod == subPeriod {
				activeTiers = append(activeTiers, t)
			}
		}
		for i := 0; i < len(activeTiers); i++ {
			for j := i + 1; j < len(activeTiers); j++ {
				if activeTiers[i].Target < activeTiers[j].Target {
					activeTiers[i], activeTiers[j] = activeTiers[j], activeTiers[i]
				}
			}
		}
		for _, t := range activeTiers {
			if val >= t.Target {
				if t.RewardType == "Percentage" {
					return val * (t.RewardAmount / 100.0)
				}
				return t.RewardAmount
			}
		}
		return 0
	}

	if calc.Type == "Commission" {
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
					if method == "Percentage" {
						payout = val * (t.Rate / 100.0)
					} else {
						payout = t.Rate
					}
					break
				}
			}
		} else if condition == "Above Target" {
			target := rules.TargetAmount
			if val > target {
				diff := val - target
				if method == "Percentage" {
					payout = diff * (rate / 100.0)
				} else {
					payout = rate
				}
			}
		} else if condition == "Per Transaction" {
			if method == "Percentage" {
				payout = val * (rate / 100.0)
			} else {
				payout = rate
			}
		} else {
			if method == "Percentage" {
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
