"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface RangeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}

function RangeInput({
                      className,
                      min = 0,
                      max = 100,
                      step = 1,
                      value,
                      defaultValue,
                      onValueChange,
                      onChange,
                      ...props
                    }: RangeInputProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value)
    onValueChange?.(newValue)
    onChange?.(event)
  }

  return (
      <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          className={cn(
              "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 slider-thumb:bg-blue-500 slider-thumb:rounded-full slider-thumb:cursor-pointer",
              className
          )}
          {...props}
      />
  )
}

export { RangeInput }