"use client"

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import type {
  ColumnDef,
  SortingState,
} from "@tanstack/react-table"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Vital = {
  date: string
  heartRate: number
  systolic: number
  diastolic: number
  weight: number
}

export function VitalsDataTable({ data }: { data: Vital[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState<string>("")

  const columns: ColumnDef<Vital>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "heartRate", header: "Heart Rate" },
    { accessorKey: "systolic", header: "Systolic" },
    { accessorKey: "diastolic", header: "Diastolic" },
    { accessorKey: "weight", header: "Weight" },
    {
      id: "actions",
      header: "Actions",
      cell: () => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Edit</Button>
          <Button size="sm" variant="destructive">Delete</Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search vitals..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />

      <div className="w-full">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hidden sm:table-row">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="block sm:table-row border-b sm:border-none"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="block sm:table-cell px-4 py-2"
                  >
                    <span className="sm:hidden font-medium text-muted-foreground">
                      {cell.column.columnDef.header as string}:
                    </span>{" "}
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
