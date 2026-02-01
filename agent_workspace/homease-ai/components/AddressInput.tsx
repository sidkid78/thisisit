'use client'

import React from 'react'

export interface AddressData {
    street: string
    city: string
    state: string
    zip: string
}

export function isValidAddress(address: AddressData, requireStreet: boolean = false): boolean {
    const hasRequiredFields = !!(
        address.city &&
        address.state &&
        address.zip &&
        address.zip.length >= 5
    )
    if (requireStreet) {
        return hasRequiredFields && !!address.street
    }
    return hasRequiredFields
}

interface AddressInputProps {
    value: AddressData
    onChange: (address: AddressData) => void
    disabled?: boolean
    className?: string
}

export function AddressInput({ value, onChange, disabled, className = '' }: AddressInputProps) {
    const handleChange = (field: keyof AddressData, fieldValue: string) => {
        onChange({
            ...value,
            [field]: fieldValue
        })
    }

    return (
        <div className={`grid gap-4 ${className}`}>
            <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Street Address
                </label>
                <input
                    type="text"
                    value={value.street}
                    onChange={(e) => handleChange('street', e.target.value)}
                    disabled={disabled}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    placeholder="123 Main St"
                />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        City
                    </label>
                    <input
                        type="text"
                        value={value.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        disabled={disabled}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        placeholder="City"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        State
                    </label>
                    <input
                        type="text"
                        value={value.state}
                        onChange={(e) => handleChange('state', e.target.value)}
                        disabled={disabled}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        placeholder="State"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        ZIP Code
                    </label>
                    <input
                        type="text"
                        value={value.zip}
                        onChange={(e) => handleChange('zip', e.target.value)}
                        disabled={disabled}
                        maxLength={10}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                        placeholder="12345"
                    />
                </div>
            </div>
        </div>
    )
}
