// hooks/useComponentRendered.ts
import { useState, useEffect, useRef } from 'react'

export function useComponentRendered() {
    const [isRendered, setIsRendered] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (ref.current) {
            setIsRendered(true)
        }
    }, [])

    return [ref, isRendered] as const
}