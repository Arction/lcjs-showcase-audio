import { lightningChart, AxisTickStrategies, emptyLine, DataPatterns, point, AxisScrollStrategies, SolidFill, ColorHEX, UIElementBuilders, UIOrigins } from "@arction/lcjs"
import { defaultStyle } from "./chartStyle"
import './styles/main.scss'

// import { lightningChart, SolidLine, SolidFill, emptyFill, emptyLine, AxisTickStrategies, AutoCursorXYBuilder, AutoCursorBuilders, ColorHEX } from "@arction/lcjs"
// import { defaultStyle } from "./chartStyle"
// import { WAV } from "./WAV"


// fetch('/Truck_driving_by-Jason_Baker-2112866529.wav')
//     .then(d => d.arrayBuffer())
//     .then(buffer => {
//         const w = new WAV(buffer)
//         console.log('WAW', w)
//     })

// const lc = lightningChart()
// const chart = lc.ChartXY({
//     containerId: 'chart',
//     defaultAxisXTickStrategy: AxisTickStrategies.NumericWithUnits,
//     defaultAxisYTickStrategy: AxisTickStrategies.NumericWithUnits,
//     autoCursorBuilder: defaultStyle.autoCursor
// })

// chart.setTitle('Sound')
// chart.setBackgroundFillStyle(defaultStyle.backgroundFill)
// chart.setBackgroundStrokeStyle(emptyLine)
// chart.setChartBackgroundStroke(defaultStyle.chart.backgroundStroke)
// chart.setChartBackgroundFillStyle(defaultStyle.chart.backgroundFill)
// chart.setChartBackgroundStroke(emptyLine)
// chart.setTitleFillStyle(defaultStyle.titleFill)
// chart.setTitleFont(defaultStyle.titleFont)

// chart.getAxes().forEach(axis => axis.setTickStyle(defaultStyle.series.tick))

// const lineSeries = chart.addLineSeries()

// lineSeries.setStrokeStyle((style: SolidLine) => style.setThickness(5).setFillStyle(new SolidFill({color:ColorHEX('#fff')})))

// lineSeries.add([
//     { x: 0, y: 0 },
//     { x: 1, y: 7 },
//     { x: 2, y: 3 },
//     { x: 3, y: 10 },
// ])




const mediaDevices = navigator.mediaDevices


mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const audioCtx = new AudioContext()
        const analyzer = audioCtx.createAnalyser()
        const src = audioCtx.createMediaStreamSource(stream)
        src.connect(analyzer)
        // analyzer.connect(audioCtx.destination)
        const timeDomainData = new Uint8Array(analyzer.fftSize)
        const frequencyData = new Uint8Array(analyzer.frequencyBinCount)
        const frequencyHistoryData = new Uint8Array(analyzer.frequencyBinCount)
        const frequencyMaxHistoryData = new Uint8Array(analyzer.frequencyBinCount)
        analyzer.getByteTimeDomainData(timeDomainData)
        analyzer.getByteFrequencyData(frequencyData)
        timeDomainSeries.setMaxPointCount(10 * 1000)
        frequencyChart.getDefaultAxisX().setInterval(0, analyzer.frequencyBinCount)
        timeDomainChart.getDefaultAxisX().setInterval(0, analyzer.fftSize)

        resetHistoryMaxButton.onMouseClick(() => {
            for (let i = 0; i < frequencyMaxHistoryData.byteLength; i++) {
                frequencyMaxHistoryData[i] = 0
            }
        })

        let maxFreqHistChanged = false
        let maxFreqTemp = 0
        function update() {
            analyzer.getByteTimeDomainData(timeDomainData)
            analyzer.getByteFrequencyData(frequencyData)
            timeDomainSeries.clear()
            timeDomainSeries.add(Array.from(timeDomainData).map((p, i) => ({ x: i, y: p })))
            frequencySeries.clear()
            frequencySeries.add(Array.from(frequencyData).map((p, i) => ({ x: i, y: p })))
            for (let i = 0; i < frequencyHistoryData.byteLength; i++) {
                frequencyHistoryData[i] = Math.max(Math.max(frequencyData[i], frequencyHistoryData[i] - 1), 0)
                maxFreqTemp = Math.max(Math.max(frequencyData[i], frequencyMaxHistoryData[i]), 0)
                if (maxFreqTemp > frequencyMaxHistoryData[i]) {
                    maxFreqHistChanged = true
                    frequencyMaxHistoryData[i] = maxFreqTemp
                }
            }
            historySeries.clear()
            historySeries.add(Array.from(frequencyHistoryData).map((p, i) => ({ x: i, y: p })))
            if (maxFreqHistChanged) {
                maxFreqSeries.clear()
                maxFreqSeries.add(Array.from(frequencyMaxHistoryData).map((p, i) => ({ x: i, y: p })))
                maxFreqHistChanged = false
            }
            window.requestAnimationFrame(update)
        }

        window.requestAnimationFrame(update)
    })

// chart

const lc = lightningChart()

const db = lc.Dashboard({
    containerId: 'chart',
    numberOfColumns: 1,
    numberOfRows: 2
})

db
    .setBackgroundFillStyle(defaultStyle.backgroundFill)
    .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)

const timeDomainChart = db.createChartXY({
    columnIndex: 0,
    columnSpan: 1,
    rowIndex: 0,
    rowSpan: 1,
    chartXYOptions: {
        defaultAxisXTickStrategy: AxisTickStrategies.NumericWithUnits,
        defaultAxisYTickStrategy: AxisTickStrategies.Numeric,
        autoCursorBuilder: defaultStyle.autoCursor
    }
})
    .setBackgroundFillStyle(defaultStyle.backgroundFill)
    .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)
    .setTitle('Time domain')

timeDomainChart
    .getAxes().forEach(axis => {
        axis.setTickStyle(defaultStyle.axis.tick)
    })
timeDomainChart.getDefaultAxisX()
    .setScrollStrategy(AxisScrollStrategies.progressive)
    .setInterval(0, 1000 * 1000)
    .setTitle('Sample')
    .setTitleFillStyle(defaultStyle.titleFill)
    .setTitleFont(defaultStyle.titleFont.setSize(14))

timeDomainChart.getDefaultAxisY()
    .setScrollStrategy(undefined)
    .setInterval(0, 256)
    .setTitle('Value')
    .setTitleFillStyle(defaultStyle.titleFill)
    .setTitleFont(defaultStyle.titleFont.setSize(14))

const timeDomainSeries = timeDomainChart.addLineSeries({
    dataPattern: DataPatterns.horizontalProgressive
})
    .setStrokeStyle(defaultStyle.series.stroke)

const frequencyChart = db.createChartXY({
    columnIndex: 0,
    columnSpan: 1,
    rowIndex: 1,
    rowSpan: 1,
    chartXYOptions: {
        defaultAxisXTickStrategy: AxisTickStrategies.NumericWithUnits,
        defaultAxisYTickStrategy: AxisTickStrategies.Numeric,
        autoCursorBuilder: defaultStyle.autoCursor
    }
})
    .setBackgroundFillStyle(defaultStyle.backgroundFill)
    .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)
    .setTitle('Frequency')

frequencyChart
    .getAxes().forEach(axis => {
        axis.setTickStyle(defaultStyle.axis.tick)
    })
frequencyChart.getDefaultAxisX()
    .setScrollStrategy(AxisScrollStrategies.progressive)
    .setTitle('Sample')
    .setTitleFillStyle(defaultStyle.titleFill)
    .setTitleFont(defaultStyle.titleFont.setSize(14))

frequencyChart.getDefaultAxisY()
    .setScrollStrategy(undefined)
    .setInterval(0, 256)
    .setTitle('Value')
    .setTitleFillStyle(defaultStyle.titleFill)
    .setTitleFont(defaultStyle.titleFont.setSize(14))

const resetHistoryMaxButton = frequencyChart
    .addUIElement(UIElementBuilders.ButtonBox.addStyler(styler => styler
        .setButtonOffFillStyle(defaultStyle.backgroundFill)
        .setButtonOffStrokeStyle(defaultStyle.ui.border)
        .setButtonOnFillStyle(defaultStyle.ui.fill)
    ))
    .setText('Reset Frequency Max')
    .setOrigin(UIOrigins.LeftTop)
    .setPosition({ x: 0, y: 100 })
    .setFont(defaultStyle.titleFont.setSize(14))
    .setTextFillStyle(defaultStyle.titleFill)

const frequencySeries = frequencyChart.addLineSeries({
    dataPattern: DataPatterns.horizontalProgressive
})
    .setStrokeStyle(defaultStyle.series.stroke)
    .setName('Frequency')

const historySeries = frequencyChart.addLineSeries({
    dataPattern: DataPatterns.horizontalProgressive
})
    .setStrokeStyle(defaultStyle.series.stroke.setFillStyle(new SolidFill({ color: ColorHEX('#ff9511') })))
    .setName('Frequency Short History')

const maxFreqSeries = frequencyChart.addLineSeries({
    dataPattern: DataPatterns.horizontalProgressive
})
    .setStrokeStyle(defaultStyle.series.stroke.setFillStyle(new SolidFill({ color: ColorHEX('#ffff11') })))
    .setName('Frequency Max')
