# LightningChart JS Audio visualization showcase

Audio visualization application created using LightningChart JS.

More information about LightningChart<sup>&#174;</sup> JS can be found from our website, https://www.arction.com/lightningchart-js/.

## Description

The audio data is extracted in realtime using [Web Audio API's](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext). 

The Web Audio API has an `.createAnalyser()` method that can be used to create a new [AnalyzerNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode).
The AnalyzerNode has methods to get time-domain data (waveform) and frequency data which is data from Fast Fourier transform on the audio signal.

The time-domain data is shown as is on the `Time Domain` chart. That same data is also pushed to the `Waveform history` chart. This chart displays the last 1 million samples of the audio input.

The last chart, `Spectrum`, is used to display three different series.

1. Spectrum of the latest samples.
2. Maximum frequencies seen.
3. Decaying frequency history.

## Audio files licenses

| File | License | Source |
|------|---------|--------|
| Truck_driving_by-Jason_Baker-2112866529.wav | Public Domain | http://soundbible.com/2097-Transfer-Truck-Drive-By.html |
| 500_1000_10000.wav | - | https://github.com/Snekw |

## Getting Started

The application is hosted at:

https://arction.github.io/lcjs-showcase-audio/

To run the application locally with hot reload:

1. Install Node.JS
2. Run `npm install`
3. Run `npm start`
4. Open browser and navigate to http://localhost:8080

## Support

If you notice an error in the example code, please open an issue on [GitHub][0].

Official [API documentation][1] can be found on [Arction][2] website.

If the docs and other materials do not solve your problem as well as implementation help is needed, ask on [StackOverflow][3] (tagged lightningchart).

If you think you found a bug in the LightningChart JavaScript library, please contact support@arction.com.

Direct developer email support can be purchased through a [Support Plan][4] or by contacting sales@arction.com.

© Arction Ltd 2009-2019. All rights reserved.

[0]: https://github.com/Arction/lcjs-showcase-trading/issues
[1]: https://www.arction.com/lightningchart-js-api-documentation
[2]: https://www.arction.com
[3]: https://stackoverflow.com/questions/tagged/lightningchart
[4]: https://www.arction.com/support-services/
