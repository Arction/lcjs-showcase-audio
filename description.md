<h1 id="lightningchart-js-audio-showcase-application">LightningChart JS Audio Visualization showcase application</h1>
<p>The audio data is extracted in realtime using <a href="https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext" rel="nofollow">Web Audio API's</a>.</p>
<p>The Web Audio API has an <code>.createAnalyser()</code> method that can be used to create a new <a href="https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode" rel="nofollow">AnalyzerNode</a>.
The AnalyzerNode has methods to get time-domain data (waveform) and frequency data which is data from Fast Fourier transform on the audio signal.</p>
<p>The time-domain data is shown as is on the <code>Time Domain</code> chart. That same data is also pushed to the <code>Waveform history</code> chart. This chart displays the last 1 million samples of the audio input.</p>
