import { SolidFill, ColorHEX, SolidLine, FontSettings, VisibleTicks, AutoCursorBuilders, PointMarkers, UIBackgrounds, emptyLine, colorPoint, FilledShape } from "@arction/lcjs"

export const defaultStyle = {
  autoCursor: AutoCursorBuilders.XY
    .setPointMarker(PointMarkers.UIDiamond)
    .setResultTableBackground(UIBackgrounds.Rectangle)
    .addStyler(styler => styler
      .setPointMarker(p => p
        .setSize({ x: 10, y: 10 })
        .setFillStyle(new SolidFill({ color: ColorHEX('#ff9511') }))
      )
      .setResultTable(table => table
        .setBackground(bg => bg
          .setFillStyle(new SolidFill({ color: ColorHEX('#a1a1a1') }))
          .setStrokeStyle(new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#ff9511') }) }))
        )
        .setFont(new FontSettings({ family: 'monospace', size: 14, weight: 500 }))
        .setTextFillStyle(new SolidFill({ color: ColorHEX('#000') }))
      )
      .setTickMarkerX(tick => tick
        .setBackground(bg => bg
          .setFillStyle(new SolidFill({ color: ColorHEX('#444') }))
          .setStrokeStyle(new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#ff9511') }) }))
        )
        .setTextFillStyle(new SolidFill({ color: ColorHEX('#fff') }))
        .setFont(new FontSettings({ family: 'monospace', size: 14, weight: 500 }))
      )
      .setTickMarkerY(tick => tick
        .setBackground(bg => bg
          .setFillStyle(new SolidFill({ color: ColorHEX('#444') }))
          .setStrokeStyle(new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#ff9511') }) }))
        )
        .setTextFillStyle(new SolidFill({ color: ColorHEX('#fff') }))
        .setFont(new FontSettings({ family: 'monospace', size: 14, weight: 500 }))
      )
    )
  ,
  backgroundFill: new SolidFill({ color: ColorHEX('#a1a1a1') }),
  backgroundStroke: emptyLine,
  titleFill: new SolidFill({ color: ColorHEX('#000') }),
  titleFont: new FontSettings({ family: 'monospace', size: 20, weight: 500 }),
  chart: {
    backgroundFill: new SolidFill({ color: ColorHEX('#444') }),
    backgroundStroke: new SolidLine({
      fillStyle: new SolidFill({ color: ColorHEX('#000') }),
      thickness: 1
    })
  },
  axis: {
    tick: new VisibleTicks({
      labelFillStyle: new SolidFill({ color: ColorHEX('#000') }),
      labelFont: new FontSettings({ family: 'monospace', size: 14, weight: 500 }),
      labelPadding: 0,
      tickStyle: new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#222') }), thickness: 2 }),
      gridStrokeStyle: new SolidLine({fillStyle: new SolidFill({color:ColorHEX('#444')})})
    })
  },
  series: {
    font: new FontSettings({ family: 'monospace' }),
    stroke: new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#fff') }), thickness: 1 })
  },
  ui: {
    border: new SolidLine({ fillStyle: new SolidFill({ color: ColorHEX('#ff9511') }) }),
    fill: new SolidFill({ color: ColorHEX('#ff9511') })
  },
  splitterStyle: new SolidLine({ thickness: 10, fillStyle: new SolidFill({ color: ColorHEX('#b0b0b0') }) })
}
