'use client'

import { useState, useRef, useEffect, useCallback, MouseEvent, TouchEvent } from 'react'
import {
    Ruler,
    X,
    Trash2,
    Download,
    Undo2,
    RotateCcw,
    Move,
    ZoomIn,
    ZoomOut,
    Info
} from 'lucide-react'

interface Point {
    x: number
    y: number
}

interface Measurement {
    id: string
    start: Point
    end: Point
    distancePixels: number
    distanceReal?: number // in inches or cm
    label?: string
    color: string
}

interface MeasurementsOverlayProps {
    imageUrl: string
    initialMeasurements?: Measurement[]
    pixelsPerInch?: number // Calibration: how many pixels = 1 inch
    unit?: 'inches' | 'cm' | 'feet'
    onMeasurementsChange?: (measurements: Measurement[]) => void
    onCalibrate?: (pixelsPerInch: number) => void
    readOnly?: boolean
}

const COLORS = [
    '#ef4444', // red
    '#f97316', // orange  
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899'  // pink
]

export function MeasurementsOverlay({
    imageUrl,
    initialMeasurements = [],
    pixelsPerInch = 96, // Default screen PPI, should be calibrated
    unit = 'inches',
    onMeasurementsChange,
    onCalibrate,
    readOnly = false
}: MeasurementsOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

    const [measurements, setMeasurements] = useState<Measurement[]>(initialMeasurements)
    const [activeMeasurement, setActiveMeasurement] = useState<Partial<Measurement> | null>(null)
    const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null)
    const [currentColor, setCurrentColor] = useState(COLORS[0])
    const [isDrawing, setIsDrawing] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null)
    const [showCalibration, setShowCalibration] = useState(false)
    const [calibrationValue, setCalibrationValue] = useState('')
    const [imageLoaded, setImageLoaded] = useState(false)
    const [history, setHistory] = useState<Measurement[][]>([])

    // Calculate real distance from pixel distance
    const calculateRealDistance = useCallback((pixelDistance: number): number => {
        const inchDistance = pixelDistance / pixelsPerInch

        switch (unit) {
            case 'cm':
                return inchDistance * 2.54
            case 'feet':
                return inchDistance / 12
            default:
                return inchDistance
        }
    }, [pixelsPerInch, unit])

    // Format distance for display
    const formatDistance = (distance: number): string => {
        const unitLabels = { inches: '"', cm: 'cm', feet: "'" }
        return `${distance.toFixed(1)}${unitLabels[unit]}`
    }

    // Get canvas coordinates from event
    const getCanvasCoordinates = (e: MouseEvent | TouchEvent): Point | null => {
        if (!canvasRef.current) return null

        const rect = canvasRef.current.getBoundingClientRect()
        let clientX: number, clientY: number

        if ('touches' in e) {
            if (e.touches.length === 0) return null
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        return {
            x: (clientX - rect.left - pan.x) / zoom,
            y: (clientY - rect.top - pan.y) / zoom
        }
    }

    // Start drawing measurement
    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
        if (readOnly) return

        const point = getCanvasCoordinates(e)
        if (!point) return

        // Check if clicking on existing measurement
        const clickedMeasurement = findMeasurementAtPoint(point)
        if (clickedMeasurement) {
            setSelectedMeasurement(clickedMeasurement.id)
            return
        }

        // Start new measurement
        setIsDrawing(true)
        setActiveMeasurement({
            id: `m-${Date.now()}`,
            start: point,
            color: currentColor
        })
        setSelectedMeasurement(null)
    }

    // Continue drawing measurement
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        const point = getCanvasCoordinates(e)
        if (!point) return

        if (isPanning && lastPanPoint) {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (!rect) return

            let clientX: number, clientY: number
            if ('touches' in e) {
                if (e.touches.length === 0) return
                clientX = e.touches[0].clientX
                clientY = e.touches[0].clientY
            } else {
                clientX = e.clientX
                clientY = e.clientY
            }

            setPan(prev => ({
                x: prev.x + (clientX - lastPanPoint.x),
                y: prev.y + (clientY - lastPanPoint.y)
            }))
            setLastPanPoint({ x: clientX, y: clientY })
            return
        }

        if (isDrawing && activeMeasurement?.start) {
            setActiveMeasurement(prev => ({
                ...prev,
                end: point,
                distancePixels: calculateDistance(prev!.start!, point)
            }))
        }
    }

    // Finish drawing measurement
    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false)
            setLastPanPoint(null)
            return
        }

        if (isDrawing && activeMeasurement?.start && activeMeasurement?.end) {
            const distancePixels = calculateDistance(activeMeasurement.start, activeMeasurement.end)

            // Only add if measurement is significant (more than 10 pixels)
            if (distancePixels > 10) {
                const newMeasurement: Measurement = {
                    id: activeMeasurement.id!,
                    start: activeMeasurement.start,
                    end: activeMeasurement.end,
                    distancePixels,
                    distanceReal: calculateRealDistance(distancePixels),
                    color: activeMeasurement.color!
                }

                saveToHistory()
                const updated = [...measurements, newMeasurement]
                setMeasurements(updated)
                onMeasurementsChange?.(updated)

                // Cycle to next color
                const currentIndex = COLORS.indexOf(currentColor)
                setCurrentColor(COLORS[(currentIndex + 1) % COLORS.length])
            }
        }

        setIsDrawing(false)
        setActiveMeasurement(null)
    }

    // Calculate distance between two points
    const calculateDistance = (p1: Point, p2: Point): number => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
    }

    // Find measurement at point
    const findMeasurementAtPoint = (point: Point): Measurement | null => {
        const threshold = 10 / zoom

        for (const m of measurements) {
            // Check if point is near the line
            const d1 = calculateDistance(point, m.start)
            const d2 = calculateDistance(point, m.end)
            const lineLength = calculateDistance(m.start, m.end)

            if (d1 + d2 <= lineLength + threshold) {
                return m
            }
        }

        return null
    }

    // Delete selected measurement
    const deleteSelected = () => {
        if (!selectedMeasurement) return

        saveToHistory()
        const updated = measurements.filter(m => m.id !== selectedMeasurement)
        setMeasurements(updated)
        onMeasurementsChange?.(updated)
        setSelectedMeasurement(null)
    }

    // Clear all measurements
    const clearAll = () => {
        saveToHistory()
        setMeasurements([])
        onMeasurementsChange?.([])
        setSelectedMeasurement(null)
    }

    // Undo last action
    const undo = () => {
        if (history.length === 0) return

        const previous = history[history.length - 1]
        setHistory(prev => prev.slice(0, -1))
        setMeasurements(previous)
        onMeasurementsChange?.(previous)
    }

    // Save current state to history
    const saveToHistory = () => {
        setHistory(prev => [...prev.slice(-9), measurements])
    }

    // Handle calibration
    const handleCalibrate = () => {
        if (!selectedMeasurement || !calibrationValue) return

        const measurement = measurements.find(m => m.id === selectedMeasurement)
        if (!measurement) return

        const realValue = parseFloat(calibrationValue)
        if (isNaN(realValue) || realValue <= 0) return

        // Convert input to inches based on current unit
        let realInches = realValue
        if (unit === 'cm') realInches = realValue / 2.54
        if (unit === 'feet') realInches = realValue * 12

        const newPPI = measurement.distancePixels / realInches
        onCalibrate?.(newPPI)
        setShowCalibration(false)
        setCalibrationValue('')

        // Update all measurements with new calibration
        const updated = measurements.map(m => ({
            ...m,
            distanceReal: calculateRealDistance(m.distancePixels)
        }))
        setMeasurements(updated)
        onMeasurementsChange?.(updated)
    }

    // Draw everything on canvas
    useEffect(() => {
        if (!canvasRef.current || !imageRef.current || !imageLoaded) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const img = imageRef.current

        // Set canvas size
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        // Clear and draw image
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.scale(zoom, zoom)
        ctx.translate(pan.x / zoom, pan.y / zoom)
        ctx.drawImage(img, 0, 0)

        // Draw measurements
        const allMeasurements = activeMeasurement?.start && activeMeasurement?.end
            ? [...measurements, activeMeasurement as Measurement]
            : measurements

        allMeasurements.forEach(m => {
            const isSelected = m.id === selectedMeasurement
            const isActive = m.id === activeMeasurement?.id

            // Draw line
            ctx.beginPath()
            ctx.moveTo(m.start.x, m.start.y)
            ctx.lineTo(m.end.x, m.end.y)
            ctx.strokeStyle = m.color
            ctx.lineWidth = isSelected ? 4 : 2
            ctx.setLineDash(isActive ? [5, 5] : [])
            ctx.stroke()
            ctx.setLineDash([])

            // Draw endpoints
            const endpointRadius = isSelected ? 8 : 6
                ;[m.start, m.end].forEach(point => {
                    ctx.beginPath()
                    ctx.arc(point.x, point.y, endpointRadius, 0, Math.PI * 2)
                    ctx.fillStyle = m.color
                    ctx.fill()
                    ctx.strokeStyle = 'white'
                    ctx.lineWidth = 2
                    ctx.stroke()
                })

            // Draw measurement label
            const midX = (m.start.x + m.end.x) / 2
            const midY = (m.start.y + m.end.y) / 2
            const distance = m.distanceReal ?? calculateRealDistance(m.distancePixels)
            const label = formatDistance(distance)

            // Calculate angle for label rotation
            const angle = Math.atan2(m.end.y - m.start.y, m.end.x - m.start.x)
            const adjustedAngle = angle > Math.PI / 2 || angle < -Math.PI / 2
                ? angle + Math.PI
                : angle

            ctx.save()
            ctx.translate(midX, midY)
            ctx.rotate(adjustedAngle)

            // Draw label background
            ctx.font = 'bold 14px sans-serif'
            const textWidth = ctx.measureText(label).width
            const padding = 6
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(
                -textWidth / 2 - padding,
                -20,
                textWidth + padding * 2,
                24
            )

            // Draw label text
            ctx.fillStyle = 'white'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, 0, -8)

            ctx.restore()
        })

        ctx.restore()
    }, [measurements, activeMeasurement, selectedMeasurement, zoom, pan, imageLoaded, calculateRealDistance, unit])

    // Handle zoom with wheel
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)))
    }

    // Reset view
    const resetView = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    return (
        <div className="relative w-full">
            {/* Toolbar */}
            {!readOnly && (
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        {/* Color picker */}
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                            {COLORS.map(color => (
                                <button
                                    title="Select color"
                                    key={color}
                                    onClick={() => setCurrentColor(color)}
                                    className={`w-6 h-6 rounded-full transition-transform ${currentColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''
                                        }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        {/* Undo */}
                        <button
                            onClick={undo}
                            disabled={history.length === 0}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo"
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>

                        {/* Delete selected */}
                        {selectedMeasurement && (
                            <button
                                onClick={deleteSelected}
                                className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 
                                    text-red-600 dark:text-red-400"
                                title="Delete selected"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}

                        {/* Clear all */}
                        {measurements.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"
                                title="Clear all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Calibrate */}
                        {selectedMeasurement && (
                            <button
                                onClick={() => setShowCalibration(true)}
                                className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 
                                    text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center gap-1"
                            >
                                <Ruler className="w-4 h-4" />
                                Calibrate
                            </button>
                        )}

                        {/* Zoom controls */}
                        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                            <button
                                title="Zoom out"
                                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-medium px-2">{Math.round(zoom * 100)}%</span>
                            <button
                                title="Zoom in"
                                onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <button
                                title="Reset zoom"
                                onClick={resetView}
                                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas container */}
            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-900"
                onWheel={handleWheel}
            >
                {/* Hidden image for loading */}
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Measurement overlay"
                    className="hidden"
                    onLoad={() => setImageLoaded(true)}
                />

                {/* Main canvas */}
                <canvas
                    ref={canvasRef}
                    className="w-full h-auto cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                />

                {/* Instructions overlay */}
                {!readOnly && measurements.length === 0 && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/60 text-white px-4 py-3 rounded-xl text-center">
                            <Ruler className="w-8 h-8 mx-auto mb-2 opacity-80" />
                            <p className="font-medium">Click and drag to measure</p>
                            <p className="text-sm text-white/70 mt-1">Select a measurement and click &quot;Calibrate&quot; for accurate results</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Measurement list */}
            {measurements.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Measurements ({measurements.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {measurements.map((m, index) => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMeasurement(m.id === selectedMeasurement ? null : m.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all
                                    ${m.id === selectedMeasurement
                                        ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-slate-500'
                                        : ''
                                    }`}
                                style={{
                                    backgroundColor: m.id === selectedMeasurement ? m.color : `${m.color}20`,
                                    color: m.id === selectedMeasurement ? 'white' : m.color
                                }}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                                <span className="font-medium">
                                    {m.label || `#${index + 1}`}: {formatDistance(m.distanceReal ?? calculateRealDistance(m.distancePixels))}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Calibration modal */}
            {showCalibration && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Calibrate Measurement
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                            Enter the real-world length of the selected measurement to calibrate all measurements.
                        </p>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="number"
                                value={calibrationValue}
                                onChange={(e) => setCalibrationValue(e.target.value)}
                                placeholder="Enter length"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 
                                    bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            />
                            <span className="px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-600 dark:text-slate-300">
                                {unit}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowCalibration(false)}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 
                                    text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCalibrate}
                                disabled={!calibrationValue}
                                className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
