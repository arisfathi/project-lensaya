import React, { useState } from 'react'

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const { src, alt, style, className, onError, ...rest } = props

  const normalizedSrc = typeof src === 'string' ? src : ''
  const didError = Boolean(normalizedSrc) && failedSrc === normalizedSrc

  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (import.meta.env.DEV) {
      const target = event.currentTarget
      // Keep this lightweight and dev-only so broken remote URLs are visible during QA.
      console.warn('[ImageWithFallback] image failed to load', {
        src,
        currentSrc: target.currentSrc,
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      })
    }
    onError?.(event)
    setFailedSrc(normalizedSrc)
  }

  return didError ? (
    <div
      className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
      </div>
    </div>
  ) : (
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}
