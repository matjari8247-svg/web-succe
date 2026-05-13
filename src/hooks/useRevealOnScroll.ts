import {useEffect, useRef, useState} from 'react'

type UseRevealOnScrollOptions = {
    once?: boolean
    threshold?: number | number[]
    rootMargin?: string
}

export function useRevealOnScroll<T extends HTMLElement = HTMLElement>({
                                                                           once = true,
                                                                           threshold = 0.2,
                                                                           rootMargin = '0px'
                                                                       }: UseRevealOnScrollOptions = {}) {
    const ref = useRef<T | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const node = ref.current
        if (!node) {
            return
        }

        if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
            setIsVisible(true)
            return
        }

        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0]

                if (entry?.isIntersecting) {
                    setIsVisible(true)

                    if (once) {
                        observer.unobserve(entry.target)
                    }
                } else if (!once) {
                    setIsVisible(false)
                }
            },
            {
                threshold,
                rootMargin
            }
        )

        observer.observe(node)

        return () => {
            observer.disconnect()
        }
    }, [once, rootMargin, threshold])

    return {ref, isVisible}
}