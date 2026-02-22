"""
Connectivity recommendation engine.
Given a school's cost fields and hub distance, recommend the most viable
connectivity option with a plain-language explanation.
"""
from typing import Optional


def recommend_connectivity(
    hub_dist_km: Optional[float],
    fiber_cost: Optional[float],
    microwave_cost: Optional[float],
    satellite_hardware_cost: Optional[float],
    satellite_opex_cost: Optional[float],
    transmission: Optional[str],
) -> dict:
    """
    Returns a ConnectivityRecommendation dict.
    All cost comparisons use source values — no source data is overwritten.
    """
    costs = {}
    if fiber_cost is not None and fiber_cost > 0:
        costs["Fiber"] = fiber_cost
    if microwave_cost is not None and microwave_cost > 0:
        costs["Microwave"] = microwave_cost
    if satellite_hardware_cost is not None and satellite_hardware_cost > 0:
        sat_total = satellite_hardware_cost + (satellite_opex_cost or 0)
        costs["Satellite"] = sat_total

    cheapest_option = min(costs, key=costs.get) if costs else None
    cheapest_cost   = costs[cheapest_option] if cheapest_option else None

    # Distance assessment
    if hub_dist_km is None:
        dist_assessment = "Hub distance unknown — satellite may be fallback"
    elif hub_dist_km <= 1:
        dist_assessment = f"Hub is very close ({hub_dist_km:.1f} km) — fiber is ideal"
    elif hub_dist_km <= 5:
        dist_assessment = f"Hub within 5 km ({hub_dist_km:.1f} km) — fiber or microwave viable"
    elif hub_dist_km <= 20:
        dist_assessment = f"Hub distance moderate ({hub_dist_km:.1f} km) — microwave preferred"
    else:
        dist_assessment = f"Hub is far ({hub_dist_km:.1f} km) — satellite likely required"

    # Build recommendation and reason
    if transmission:
        recommended = transmission
        reason = f"Source data specifies '{transmission}' as the planned transmission method."
    elif cheapest_option:
        recommended = cheapest_option
        parts = []
        if hub_dist_km is not None:
            if hub_dist_km > 20 and cheapest_option != "Satellite":
                parts.append(f"hub distance is high ({hub_dist_km:.1f} km) which may make {cheapest_option} impractical")
        parts.append(f"{cheapest_option} has the lowest estimated cost (${cheapest_cost:,.0f})")
        reason = "; ".join(parts).capitalize() + "."
    else:
        recommended = "Satellite"
        reason = "No cost data available — satellite recommended as universal fallback."

    return {
        "recommended_option": recommended,
        "reason": reason,
        "cheapest_option": cheapest_option,
        "cheapest_cost": cheapest_cost,
        "hub_distance_assessment": dist_assessment,
    }


def apply_scenario(
    school: dict,
    cost_per_meter_override: Optional[float] = None,
    satellite_opex_years: int = 5,
    power_opex_years: int = 5,
) -> dict:
    """
    Compute scenario-adjusted costs WITHOUT mutating source values.
    Returns a dict of derived scenario fields.
    """
    result = {}

    hub_dist_m = school.get("hub_dist_m") or 0

    if cost_per_meter_override is not None and hub_dist_m:
        result["scenario_fiber_cost"] = cost_per_meter_override * hub_dist_m
    else:
        result["scenario_fiber_cost"] = school.get("fiber_cost")

    sat_hw    = school.get("satellite_hardware_cost") or 0
    sat_opex  = school.get("satellite_opex_cost") or 0
    result["scenario_satellite_total"] = sat_hw + (sat_opex * satellite_opex_years)

    pwr_opex  = school.get("power_opex") or 0
    result["scenario_power_total"]     = (school.get("power_cost") or 0) + (pwr_opex * power_opex_years)

    return result
