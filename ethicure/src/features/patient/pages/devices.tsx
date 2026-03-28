import { useMemo, useState, useEffect, type FormEvent } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Droplet,
  Flame,
  Gauge,
  HeartPulse,
  MoonStar,
  PlugZap,
  RefreshCw,
  Stethoscope,
  Trash,
  Watch,
  WifiOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState as useReactState } from "react"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  // AlertDialogCancel,
  // AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type DeviceStatus = "online" | "syncing" | "offline"
type DeviceType =
  | "Heart Rate"
  | "Blood Pressure"
  | "Glucose"
  | "Step Count"
  | "Oxygen"
  | "Calories"
  | "Sleep"
  | "Smart Watch"

type Device = {
  key: string
  brand?: string
  name: string
  label: string
  type: DeviceType
  status: DeviceStatus
  lastSync: string
  icon: LucideIcon
}

// Backend device type
type BackendDevice = {
  id: number
  device_type: string
  label: string | null
  brand?: string | null
  status: string
  last_synced: string | null
}

import { API_BASE_URL } from "@/lib/api"

const typeIcons: Record<DeviceType, LucideIcon> = {
  "Heart Rate": HeartPulse,
  "Blood Pressure": Stethoscope,
  Glucose: Droplet,
  "Step Count": Activity,
  Oxygen: Gauge,
  Calories: Flame,
  Sleep: MoonStar,
  "Smart Watch": Watch,
}

const deviceTypes: DeviceType[] = [
  "Heart Rate",
  "Blood Pressure",
  "Glucose",
  "Step Count",
  "Oxygen",
  "Calories",
  "Sleep",
  "Smart Watch",
]

const watchBrands = ["Apple", "Samsung", "Garmin", "Fitbit", "Polar", "Coros", "Other"] as const

// Helper to map backend device_type to DeviceType
const backendToDeviceType: Record<string, DeviceType> = {
  heart: "Heart Rate",
  glucose: "Glucose",
  steps: "Step Count",
  calories: "Calories",
  oxygen: "Oxygen",
  sleep: "Sleep",
  bp: "Blood Pressure",
  blood_pressure: "Blood Pressure",
  smart_watch: "Smart Watch",
}

function mapBackendDevice(d: BackendDevice): Device {
  const type = backendToDeviceType[d.device_type] || (d.device_type as DeviceType)
  return {
    key: String(d.id),
    brand: d.brand || undefined,
    name: type === "Smart Watch" ? "Smart Watch" : `${type} Monitor`,
    label: d.label || "",
    type,
    status: (d.status as DeviceStatus) || "offline",
    lastSync: d.last_synced ? new Date(d.last_synced).toLocaleString() : "",
    icon: typeIcons[type] || PlugZap,
  }
}

const statusBadge: Record<DeviceStatus, string> = {
  online: "border-emerald-200 bg-emerald-100 text-emerald-800",
  syncing: "border-blue-200 bg-blue-100 text-blue-800",
  offline: "border-amber-200 bg-amber-100 text-amber-800",
}

export default function DevicesPage() {
  const [deviceList, setDeviceList] = useState<Device[]>([])
    // Fetch devices from backend on mount
    useEffect(() => {
      async function fetchDevices() {
        try {
          const token = window.localStorage.getItem("accessToken")
          const res = await fetch(`${API_BASE_URL}/api/devices/`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          })
          if (!res.ok) throw new Error("Failed to fetch devices")
          const data = await res.json()
          setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
        } catch (e) {
          setDeviceList([])
        }
      }
      fetchDevices()
    }, [])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [newDevice, setNewDevice] = useState<{
    name: string
    label: string
    type: DeviceType
    brand: string
  }>({
    name: "",
    label: "",
    type: "Heart Rate",
    brand: "",
  })

  const usedTypes = useMemo(() => new Set(deviceList.map((device) => device.type)), [deviceList])
  const firstAvailableType = useMemo(
    () => deviceTypes.find((type) => !usedTypes.has(type)) ?? "Heart Rate",
    [usedTypes]
  )
  const allTypesUsed = usedTypes.size >= deviceTypes.length

  const onlineCount = useMemo(() => deviceList.filter((device) => device.status === "online").length, [deviceList])
  const syncingCount = useMemo(() => deviceList.filter((device) => device.status === "syncing").length, [deviceList])
  const offlineCount = useMemo(() => deviceList.filter((device) => device.status === "offline").length, [deviceList])

  const handleAddDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newDevice.name.trim()) {
      setFormError("Device name is required.")
      return
    }
    if (newDevice.type === "Smart Watch" && !newDevice.brand) {
      setFormError("Please pick a watch brand.")
      return
    }
    if (usedTypes.has(newDevice.type)) {
      setFormError("That device type is already connected.")
      return
    }
    try {
      const token = window.localStorage.getItem("accessToken")
      // Map DeviceType to backend device_type
      const deviceTypeMap: Record<string, string> = {
        "Heart Rate": "heart",
        "Blood Pressure": "blood_pressure",
        "Glucose": "glucose",
        "Step Count": "steps",
        "Oxygen": "oxygen",
        "Calories": "calories",
        "Sleep": "sleep",
        "Smart Watch": "smart_watch",
      }
      const payload: any = {
        device_type: deviceTypeMap[newDevice.type] || newDevice.type,
        label: newDevice.label.trim() || (newDevice.type === "Smart Watch" && newDevice.brand ? `${newDevice.brand} watch` : "Added manually"),
        brand: newDevice.type === "Smart Watch" ? newDevice.brand : undefined,
        status: "online",
      }
      // Remove undefined fields (like brand if not Smart Watch)
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
      const res = await fetch(`${API_BASE_URL}/api/devices/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let msg = `Failed to add device (${res.status}).`
        try {
          const contentType = res.headers.get("content-type") || ""
          if (contentType.includes("application/json")) {
            const data = await res.json()
            msg =
              data?.error ||
              data?.detail ||
              (typeof data === "object" && Object.values(data)[0]) ||
              msg
          } else {
            const text = (await res.text()).trim()
            if (text) {
              msg = `${msg} ${text.slice(0, 220)}`
            }
          }
        } catch {
          // Keep fallback status-based message
        }
        setFormError(msg)
        return
      }
      // Refetch device list after add
      setIsAddOpen(false)
      setNewDevice({ name: "", label: "", type: "Heart Rate", brand: "" })
      setFormError(null)
      // Fetch updated list
      const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (updated.ok) {
        const data = await updated.json()
        setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
      }
    } catch (e) {
      setFormError("Failed to add device.")
    }
  }

  // const [deleteConfirm, setDeleteConfirm] = useReactState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useReactState<string | null>(null)
  const handleDelete = (key: string) => {
    setPendingDelete(key)
  }
  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      const token = window.localStorage.getItem("accessToken")
      const res = await fetch(`${API_BASE_URL}/api/devices/${pendingDelete}/`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        setDeviceList((prev) => prev.filter((d) => d.key !== pendingDelete))
      }
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Connections
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Devices</h1>
            <p className="text-sm text-muted-foreground">
              Calm overview of connected devices, sync health, and quick fixes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={async () => {
                const token = window.localStorage.getItem("accessToken")
                // Sync all online devices
                await Promise.all(
                  deviceList
                    .filter((d) => d.status === "online")
                    .map(async (device) => {
                      await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ status: "syncing" }),
                      })
                      setTimeout(async () => {
                        await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ status: "online", last_synced: new Date().toISOString() }),
                        })
                        // Optionally refetch device list after all syncs
                        const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                        })
                        if (updated.ok) {
                          const data = await updated.json()
                          setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
                        }
                      }, 1500)
                    })
                )
              }}
            >
              <RefreshCw className="h-4 w-4" /> Sync all
            </Button>
            <Sheet
              open={isAddOpen}
              onOpenChange={(open) => {
                setIsAddOpen(open)
                if (open) {
                  setFormError(null)
                  setNewDevice({
                    name: "",
                    label: "",
                    type: firstAvailableType,
                    brand: firstAvailableType === "Smart Watch" ? "Apple" : "",
                  })
                }
              }}
            >
              <Button
                size="sm"
                className="gap-1.5"
                disabled={allTypesUsed}
                type="button"
                onClick={() => setIsAddOpen(true)}
              >
                + Add device
              </Button>
              <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Add a device</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose a supported device type and add a short label.
                  </p>
                </SheetHeader>

                <form className="space-y-4 px-4 pb-6" onSubmit={handleAddDevice}>
                  <div className="space-y-2">
                    <Label>Device type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {deviceTypes.map((type) => {
                        const disabled = usedTypes.has(type)
                        const isActive = newDevice.type === type
                        const Icon = typeIcons[type]
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setFormError(null)
                              setNewDevice((prev) => ({
                                ...prev,
                                type,
                                brand: type === "Smart Watch" ? prev.brand || "Apple" : "",
                              }))
                            }}
                            className={
                              "flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:border-primary/60 hover:bg-primary/5 " +
                              (isActive ? "border-primary bg-primary/5" : "border-border/70") +
                              (disabled ? " cursor-not-allowed opacity-50" : "")
                            }
                            aria-pressed={isActive}
                          >
                            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex flex-col text-sm leading-tight">
                              <span className="font-medium">{type}</span>
                              <span className="text-xs text-muted-foreground">
                                {disabled ? "Already added" : "Tap to select"}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device name</Label>
                    <Input
                      id="device-name"
                      placeholder="e.g. Garmin HRM-Pro"
                      required
                      value={newDevice.name}
                      onChange={(event) =>
                        setNewDevice((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device-label">Label (optional)</Label>
                    <Input
                      id="device-label"
                      placeholder="Where or how you use it"
                      value={newDevice.label}
                      onChange={(event) =>
                        setNewDevice((prev) => ({ ...prev, label: event.target.value }))
                      }
                    />
                  </div>

                  {newDevice.type === "Smart Watch" && (
                    <div className="space-y-2">
                      <Label htmlFor="watch-brand">Brand</Label>
                      <Select
                        value={newDevice.brand}
                        onValueChange={(value) =>
                          setNewDevice((prev) => ({ ...prev, brand: value ?? "" }))
                        }
                      >
                        <SelectTrigger id="watch-brand" className="w-full">
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {watchBrands.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <SheetFooter className="pt-2">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={allTypesUsed}>
                        Add device
                      </Button>
                    </div>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Connected</CardTitle>
            <CardDescription>Live devices streaming data</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between pt-0">
            <span className="text-3xl font-semibold">{onlineCount}</span>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Stable
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Syncing</CardTitle>
            <CardDescription>Jobs running quietly</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between pt-0">
            <span className="text-3xl font-semibold">{syncingCount}</span>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              In progress
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Attention</CardTitle>
            <CardDescription>Needs a quick check</CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between pt-0">
            <span className="text-3xl font-semibold">{offlineCount}</span>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              Offline
            </Badge>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-xs border-border/70">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Connected devices</CardTitle>
            <CardDescription>Sync cadence, status, and quick actions.</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <PlugZap className="h-3.5 w-3.5" /> Auto-sync on
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop / tablet table */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-lg border border-border/70">
                <Table className="min-w-[720px]">
                  <TableHeader className="bg-muted/60">
                    <TableRow>
                      <TableHead className="pl-6">Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last synced</TableHead>
                      <TableHead className="text-end">Action</TableHead>
                      <TableHead className="text-end pr-6">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviceList.map((device) => (
                      <TableRow key={device.key} className="hover:bg-muted/40">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <device.icon className="h-5 w-5" />
                            </span>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium leading-tight">{device.name}</p>
                                <Badge variant="outline" className="text-[11px]">
                                  {device.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{device.label}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className={statusBadge[device.status]}>
                            {device.status === "online" && "Online"}
                            {device.status === "syncing" && "Syncing"}
                            {device.status === "offline" && "Offline"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {device.status === "offline" ? (
                              <WifiOff className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Activity className="h-4 w-4 text-primary" />
                            )}
                            <span>{device.lastSync}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-end whitespace-nowrap pr-2">
                          {device.status === "online" && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                              const token = window.localStorage.getItem("accessToken")
                              // Set status to syncing
                              await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: "syncing" }),
                              })
                              // Simulate sync delay, then set last_synced and status=online
                              setTimeout(async () => {
                                await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ status: "online", last_synced: new Date().toISOString() }),
                                })
                                // Refetch device list
                                const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                  },
                                })
                                if (updated.ok) {
                                  const data = await updated.json()
                                  setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
                                }
                              }, 1500)
                            }}>
                              <RefreshCw className="h-4 w-4" />
                              Sync now
                            </Button>
                          )}
                          {device.status === "syncing" && (
                            <Button size="sm" variant="secondary" disabled>
                              Syncing
                            </Button>
                          )}
                          {device.status === "offline" && (
                            <Button size="sm" variant="destructive" className="gap-2" onClick={async () => {
                              const token = window.localStorage.getItem("accessToken")
                              await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: "online" }),
                              })
                              // Refetch device list
                              const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                              })
                              if (updated.ok) {
                                const data = await updated.json()
                                setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
                              }
                            }}>
                              <WifiOff className="h-4 w-4" />
                              Reconnect
                            </Button>
                          )}
                        </TableCell>

                        <TableCell className="text-end pr-6">
                          <AlertDialog open={pendingDelete === device.key} onOpenChange={(open) => !open && setPendingDelete(null)}>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  aria-label={`Remove ${device.name}`}
                                  onClick={() => handleDelete(device.key)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive">Delete {device.name}?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  This action cannot be undone. This will permanently remove the device from your account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
                                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 px-4 pb-4 pt-3">
            {deviceList.map((device) => (
              <div key={device.key} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <device.icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium leading-tight">{device.name}</p>
                      <Badge variant="outline" className="text-[11px]">
                        {device.type}
                      </Badge>
                      <Badge variant="outline" className={statusBadge[device.status]}>
                        {device.status === "online" && "Online"}
                        {device.status === "syncing" && "Syncing"}
                        {device.status === "offline" && "Offline"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{device.label}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {device.status === "offline" ? (
                        <WifiOff className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Activity className="h-4 w-4 text-primary" />
                      )}
                      <span>{device.lastSync}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {device.status === "online" && (
                          <Button size="sm" variant="outline" className="gap-2" onClick={async () => {
                            const token = window.localStorage.getItem("accessToken")
                            // Set status to syncing
                            await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                              method: "PUT",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ status: "syncing" }),
                            })
                            // Simulate sync delay, then set last_synced and status=online
                            setTimeout(async () => {
                              await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ status: "online", last_synced: new Date().toISOString() }),
                              })
                              // Refetch device list
                              const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                              })
                              if (updated.ok) {
                                const data = await updated.json()
                                setDeviceList(Array.isArray(data) ? data.map(mapBackendDevice) : [])
                              }
                            }, 1500)
                          }}>
                            <RefreshCw className="h-4 w-4" />
                            Sync now
                          </Button>
                        )}
                        {device.status === "syncing" && (
                          <Button size="sm" variant="secondary" disabled>
                            Syncing
                          </Button>
                        )}
                        {device.status === "offline" && (
                          <Button size="sm" variant="destructive" className="gap-2" onClick={async () => {
                            const token = window.localStorage.getItem("accessToken")
                            await fetch(`${API_BASE_URL}/api/devices/${device.key}/`, {
                              method: "PUT",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ status: "online" }),
                            })
                            // Refetch device list
                            const updated = await fetch(`${API_BASE_URL}/api/devices/`, {
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                            })
                            if (updated.ok) {
                              const data = await updated.json()
                              setDeviceList(Array.isArray(data) ? data.filter((d:any)=>d.is_active!==false).map(mapBackendDevice) : [])
                            }
                          }}>
                            <WifiOff className="h-4 w-4" />
                            Reconnect
                          </Button>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        aria-label={`Remove ${device.name}`}
                        onClick={() => handleDelete(device.key)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
