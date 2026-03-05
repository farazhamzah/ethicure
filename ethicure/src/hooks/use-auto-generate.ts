import { useEffect } from "react"
import { createReading } from "@/lib/api"

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function dailyFraction(hour: number, minute: number) {
  const p = (hour + minute / 60 + 1) / 24
  return 0.05 + 0.95 * Math.pow(p, 1.6)
}

function localDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function useAutoGenerate() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const access = window.localStorage.getItem("accessToken")
    const role = window.localStorage.getItem("authRole")
    const patientId = window.localStorage.getItem("patientId")

    if (!access || role !== "patient" || !patientId) return

    const pid = String(patientId)
    let stopped = false

    // load or initialize per-day profile stored in localStorage
    function loadProfile() {
      const key = `autoGen:profile:${pid}`
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch (err) {
        return null
      }
    }

    function saveProfile(obj: any) {
      const key = `autoGen:profile:${pid}`
      try {
        window.localStorage.setItem(key, JSON.stringify(obj))
      } catch (err) {
        // ignore
      }
    }

    async function generateOnce() {
      if (stopped) return
      try {
        const now = new Date()
        const today = localDateKey(now)

        let profile = loadProfile()
        if (!profile || profile.date !== today) {
          // start a new day profile, centered around ~10k steps / ~2k calories
          profile = {
            date: today,
            targetSteps: Math.max(4000, Math.round(10000 + (Math.random() - 0.5) * 3000)),
            targetCalories: Math.max(1600, Math.round(2000 + (Math.random() - 0.5) * 500)),
            lastSteps: 0,
            lastCalories: 0,
          }
        }

        const hour = now.getHours()
        const minute = now.getMinutes()
        let frac = dailyFraction(hour, minute)
        // Late-day floor so catching up near bedtime still looks “finished”
        if (hour >= 22) frac = Math.max(frac, 0.98)
        else if (hour >= 20) frac = Math.max(frac, 0.95)
        frac = Math.min(1, frac)

        // desired cumulative values
        const desiredSteps = Math.round(profile.targetSteps * frac + (Math.random() - 0.5) * 80)
        const desiredCalories = Math.round(profile.targetCalories * frac + (Math.random() - 0.5) * 30)

        // enforce monotonic non-decreasing within day
        const cumulativeSteps = Math.max(profile.lastSteps || 0, desiredSteps)
        const cumulativeCalories = Math.max(profile.lastCalories || 0, desiredCalories)

        // small per-2-minute variability for instantaneous values
        const instantSteps = Math.max(0, cumulativeSteps - (profile.lastSteps || 0))
        const instantCalories = Math.max(0, cumulativeCalories - (profile.lastCalories || 0))

        // vitals and extras (populate many ReadingDraft columns)
        const heartRate = Math.round( (70 + (Math.random()-0.5)*12 + (hour>=16 && hour<=20 ? 3 : 0)) * 10 ) / 10
        const systolic = Math.round( (118 + (Math.random()-0.5)*12 + (hour>=12 && hour<=18 ? 2 : 0)) * 10 ) / 10
        const diastolic = Math.round( (76 + (Math.random()-0.5)*8) * 10 ) / 10
        const glucose = Math.round( (95 + (Math.random()-0.5)*18 + (hour>=7 && hour<=9 ? 10 : 0)) * 10 ) / 10
        const oxygen = Math.round( (98 + (Math.random()-0.5)*1.2) * 10 ) / 10
        const heart_hrv_ms = Math.round(Math.max(10, 50 + (Math.random()-0.5) * 30) * 10) / 10
        const heart_rr_interval_ms = Math.round(Math.max(300, 800 + (Math.random()-0.5) * 200) * 10) / 10
        const glucose_trend = Math.random() > 0.5 ? "stable" : Math.random() > 0.5 ? "rising" : "falling"
        const glucose_hba1c = Math.round((5.5 + (Math.random()-0.5)*1.2) * 10) / 10
        const basal_calories = Math.round(profile.targetCalories * 0.6)
        const metabolic_equivalent = Math.round((1 + Math.random()*2) * 10) / 10
        const daily_steps = profile.targetSteps
        const step_distance_km = Math.round((cumulativeSteps * 0.00076) * 100) / 100
        const walking_pace = Math.round((4 + (Math.random()-0.5)*1.2) * 10) / 10
        const cadence = Math.round(100 + (Math.random()-0.5) * 30)
        const floors_climbed = Math.max(0, Math.round((cumulativeSteps / 2000) + (Math.random()-0.5)*2))
        const vo2_max = Math.round((35 + (Math.random()-0.5)*8) * 10) / 10
        const respiration_rate = Math.round((14 + (Math.random()-0.5)*3) * 10) / 10
        const oxygen_variability = Math.round((0.5 + Math.random()*1.5) * 10) / 10
        const sleep_stage = Math.random() > 0.95 ? "rem" : Math.random() > 0.5 ? "light" : "deep"
        const sleep_duration_minutes = Math.round(Math.max(0, (6 + (Math.random()-0.5)*2) * 60))
        const sleep_score = Math.round((60 + (Math.random()-0.5)*20))
        const body_temperature = Math.round((36 + (Math.random()-0.5)*0.6) * 10) / 10
        const skin_temperature = Math.round((33 + (Math.random()-0.5)*1.2) * 10) / 10
        const heart_ecg = Math.random() > 0.995 ? "arrhythmia" : "normal"
        const heart_afib = Math.random() > 0.995
        const bp_irregular = Math.random() > 0.995
        const bp_body_position = Math.random() > 0.5 ? "sitting" : "standing"
        const glucose_fasting = hour < 7

        const payload: Record<string, unknown> = {
          recorded_at: now.toISOString(),
          heart_device_id: 1,
          heart_rate: heartRate,
          heart_ecg,
          heart_afib,
          heart_hrv_ms,
          heart_rr_interval_ms,
          bp_device_id: 2,
          bp_systolic: systolic,
          bp_diastolic: diastolic,
          bp_mean: Math.round(((systolic + 2 * diastolic) / 3) * 10) / 10,
          bp_pulse_pressure: Math.round((systolic - diastolic) * 10) / 10,
          bp_irregular,
          bp_body_position,
          glucose_device_id: 3,
          glucose,
          glucose_trend,
          glucose_hba1c,
          glucose_fasting,
          steps_device_id: 4,
          steps: cumulativeSteps,
          daily_steps,
          step_distance_km,
          walking_pace,
          cadence,
          floors_climbed,
          calories_device_id: 5,
          calories: cumulativeCalories,
          basal_calories,
          calories: cumulativeCalories, // fill the simple calories column
          total_calories: cumulativeCalories,
          metabolic_equivalent,
          oxygen_device_id: 6,
          oxygen,
          vo2_max,
          respiration_rate,
          oxygen_variability,
          sleep_stage,
          sleep_duration_minutes,
          sleep_score,
          body_temperature,
          skin_temperature,
          patient: Number(pid),
        }

        // post to API
        await createReading(payload)

        // persist profile state
        profile.lastSteps = cumulativeSteps
        profile.lastCalories = cumulativeCalories
        saveProfile(profile)
      } catch (err) {
        // surface errors for debugging while still keeping loop alive
        if (typeof console !== "undefined") {
          console.warn("auto-generate: failed to post reading", err)
        }
      }
    }

    // run immediately and every 2 minutes
    generateOnce()
    const intervalId = window.setInterval(generateOnce, 120000)

    function onStorage(e: StorageEvent) {
      if (e.key === "accessToken" && !e.newValue) {
        stopped = true
        clearInterval(intervalId)
      }
    }

    window.addEventListener("storage", onStorage)

    return () => {
      stopped = true
      clearInterval(intervalId)
      window.removeEventListener("storage", onStorage)
    }
  }, [])
}
