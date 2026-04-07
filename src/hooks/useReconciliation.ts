'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

export function useReconciliationAccounts() {
    const [accounts, setAccounts] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchAccounts = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/reconciliation/accounts')
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setAccounts(data)
        } catch (err: any) {
            setError(err)
            toast.error('Failed to load accounts: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

    return { accounts, isLoading, error, refetch: fetchAccounts }
}

export function useReconciliationLines(accountId: string) {
    const [lines, setLines] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchLines = useCallback(async () => {
        if (!accountId) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/reconciliation/${accountId}/lines`)
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setLines(data)
        } catch (err: any) {
            setError(err)
            toast.error('Failed to load lines: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }, [accountId])

    useEffect(() => {
        fetchLines()
    }, [fetchLines])

    return { lines, isLoading, error, refetch: fetchLines }
}

export function useStartReconciliation() {
    const [isLoading, setIsLoading] = useState(false)

    const start = async (accountId: string, data: { statement_date: string, statement_ending_balance: number }) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/reconciliation/${accountId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            return result
        } catch (err: any) {
            toast.error('Failed to start reconciliation: ' + err.message)
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    return { start, isLoading }
}

export function useCompleteReconciliation() {
    const [isLoading, setIsLoading] = useState(false)

    const complete = async (accountId: string, data: { reconciliation_id: string, cleared_line_ids: string[] }) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/reconciliation/${accountId}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            
            toast.success('Reconciliation completed successfully')
            return result
        } catch (err: any) {
            toast.error('Failed to complete reconciliation: ' + err.message)
            throw err
        } finally {
            setIsLoading(false)
        }
    }

    return { complete, isLoading }
}
