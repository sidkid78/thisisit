'use client'

import { useState } from 'react'

type PurchaseLeadButtonProps = {
    matchId: string
    projectTitle?: string
}

export default function PurchaseLeadButton({ matchId, projectTitle }: PurchaseLeadButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handlePurchase = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId, projectTitle }),
            })

            const data = await response.json()

            if (data.url) {
                window.location.href = data.url
            } else {
                alert(data.error || 'Failed to create checkout session')
            }
        } catch (error) {
            console.error('Purchase error:', error)
            alert('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handlePurchase}
            disabled={isLoading}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
        >
            {isLoading ? (
                'Processing...'
            ) : (
                <>
                    <span>💰</span>
                    Purchase Lead - $49
                </>
            )}
        </button>
    )
}
