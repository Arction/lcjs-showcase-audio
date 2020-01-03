export type Scaler = (n: number) => number

/**
 * Scale value from one scale to another
 * @param val Value to scale
 * @param origRange Range of the original scale
 * @param newRange New scale
 */
export const scaleToRange = (val: number, origRange: [number, number], newRange: [number, number]): number =>
    (val - origRange[0]) * (newRange[1] - newRange[0]) / (origRange[1] - origRange[0]) + newRange[0]

/**
 * Scaler that scales to from 0, 256 to a decibel range specified by analyzer node
 * @param analyzer Analyzer node of which the db scale should be used
 */
export const dbScaler = (analyzer: AnalyserNode): Scaler => (n: number): number => scaleToRange(n, [0, 256], [analyzer.minDecibels, analyzer.maxDecibels])

/**
 * Scaler that scales from 0-256 to -1,1
 * @param n 
 */
export const freqScaler: Scaler = (n: number): number => scaleToRange(n, [0, 256], [-1, 1])

/**
 * Scaler with no scaling
 * @param n 
 */
export const noScaler: Scaler = (n) => n

/**
 * Scaler that scales by offset
 * @param offset Offset
 */
export const offSetScaler = (offset: number): Scaler => (n) => n + offset

/**
 * Scaler that scales by multiplier
 * @param multiplier Multiplier of the scaler
 */
export const multiplierScaler = (multiplier): Scaler => (n) => n * multiplier
