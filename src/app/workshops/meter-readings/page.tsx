"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Gauge, RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";

/**
 * Bike Meter Readings — manager review surface for the fleet-bike daily
 * fuel-meter readings submitted from the Bikes workshop app.
 *
 * Data: GET /api/workshops/meter-readings?date=YYYY-MM-DD (reviewer gate:
 * admin / manager / jobs.reports). The API derives the day's bike list
 * from the readings themselves (there is no fleet registry), so a bike
 * with no readings at all on the selected day does not appear here — a
 * bike with only one of the two readings is flagged as incomplete.
 */

interface Reading {
  id: string;
  bikeRegNo: string;
  period: string;
  odometerKm: number;
  photo: string;
  createdAt: string;
  employee?: { id: string; name: string } | null;
}

interface BikeDay {
  bikeRegNo: string;
  morning: Reading | null;
  afternoon: Reading | null;
  distanceKm: number | null;
  missing: string[];
}

function todayKey(): string {
  // Pakistan calendar day (UTC+5, no DST) as YYYY-MM-DD.
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ReadingCell({ reading, label }: { reading: Reading | null; label: string }) {
  const [zoomed, setZoomed] = useState(false);
  if (!reading) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <AlertTriangle className="w-4 h-4" />
        <span>{label} reading missing</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setZoomed(true)} title="View meter photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reading.photo}
          alt={`${label} meter`}
          className="w-14 h-14 object-cover rounded border border-zinc-200"
        />
      </button>
      <div className="text-sm">
        <div className="font-semibold text-zinc-800">{reading.odometerKm.toLocaleString()} km</div>
        <div className="text-zinc-500">{reading.employee?.name || "—"}</div>
        <div className="text-zinc-400 text-xs">
          {new Date(reading.createdAt).toLocaleTimeString("en-PK", { timeZone: "Asia/Karachi" })}
        </div>
      </div>
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white"
            onClick={() => setZoomed(false)}
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reading.photo}
            alt={`${label} meter (full)`}
            className="max-h-full max-w-full rounded shadow-xl"
          />
        </div>
      )}
    </div>
  );
}

export default function BikeMeterReadingsPage() {
  const [date, setDate] = useState<string>(todayKey());
  const [bikeFilter, setBikeFilter] = useState("");
  const [bikes, setBikes] = useState<BikeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ date });
      if (bikeFilter.trim()) params.set("bikeRegNo", bikeFilter.trim());
      const res = await fetch(`/api/workshops/meter-readings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load meter readings");
      setBikes(Array.isArray(data.bikes) ? data.bikes : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load meter readings");
      setBikes([]);
    } finally {
      setLoading(false);
    }
  }, [date, bikeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const incomplete = bikes.filter((b) => b.missing.length > 0).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        moduleName="Workshops"
        title="Bike Meter Readings"
        subtitle="Daily fuel-meter readings (morning start + afternoon return) submitted by riders from the Bikes app."
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-zinc-300 rounded px-3 py-2 bg-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Bike reg no (optional)</span>
          <input
            type="text"
            value={bikeFilter}
            onChange={(e) => setBikeFilter(e.target.value)}
            placeholder="e.g. LEA-1234"
            className="border border-zinc-300 rounded px-3 py-2 bg-white"
          />
        </label>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-zinc-900 text-white text-sm hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        {!loading && !error && (
          <span className="text-sm text-zinc-500 pb-2">
            {bikes.length} bike(s) with readings · {incomplete} incomplete
          </span>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading readings…</div>
      ) : bikes.length === 0 && !error ? (
        <div className="rounded border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          No meter readings submitted for this day.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bikes.map((bike) => (
            <div key={bike.bikeRegNo} className="rounded-lg border border-zinc-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-zinc-800">
                  <Gauge className="w-5 h-5 text-amber-500" />
                  {bike.bikeRegNo}
                </div>
                {bike.missing.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                    <AlertTriangle className="w-4 h-4" /> Missing {bike.missing.join(" + ")}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Morning (start)</div>
                  <ReadingCell reading={bike.morning} label="Morning" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Afternoon (return)</div>
                  <ReadingCell reading={bike.afternoon} label="Afternoon" />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-3 text-sm">
                {bike.distanceKm != null ? (
                  <span className="text-zinc-700">
                    Distance today: <strong>{bike.distanceKm.toLocaleString()} km</strong>
                  </span>
                ) : (
                  <span className="text-zinc-400">Distance available once both readings are in.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Note: this list is built from the day&apos;s submitted readings — a bike with no readings at all
        on the selected day cannot be shown as missing until a fleet register exists.
      </p>
    </div>
  );
}
