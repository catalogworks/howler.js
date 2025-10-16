/**
 * @file Howler.js Core - A modern web audio library
 * @version 3.0.0
 * @author @catalogworks
 * @copyright Copyright (c) 2013-2025 @catalogworks
 * @license MIT License
 */
/**
 * Global Howler object
 */
class HowlerGlobal {
    /**
     * Initialize the global Howler object
     */
    constructor() {
        // Additional private properties for improved typings
        this._suspendTimer = null;
        this._resumeAfterSuspend = false;
        this.state = 'running';
        this.init();
    }
    /**
     * Initialize the global Howler object
     * @return Reference to the Howler object
     */
    init() {
        // Create a global ID counter
        this._counter = 1000;
        // Pool of unlocked HTML5 Audio objects
        this._html5AudioPool = [];
        this.html5PoolSize = 10;
        // Internal properties
        this._codecs = {};
        this._howls = [];
        this._muted = false;
        this._volume = 1;
        this._canPlayEvent = 'canplaythrough';
        this._navigator = typeof window !== 'undefined' && window.navigator ? window.navigator : null;
        this._stateEvents = ['running', 'suspended'];
        this._unlockTimeout = null;
        // Public properties
        this.masterGain = null;
        this.noAudio = false;
        this.usingWebAudio = true;
        this.autoSuspend = true;
        this.ctx = null;
        this.autoUnlock = true;
        // Setup the various state values for global tracking
        this._setupAudioContext();
        return this;
    }
    /**
     * Get/set the global volume for all sounds
     * @param vol Volume from 0.0 to 1.0
     * @return Returns self or current volume
     */
    volume(vol) {
        // If no AudioContext created yet, run the setup
        if (!this.ctx) {
            this._setupAudioContext();
        }
        if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {
            this._volume = vol;
            // Don't update any of the nodes if we are muted
            if (this._muted) {
                return this;
            }
            // When using Web Audio, we just need to adjust the master gain
            if (this.usingWebAudio && this.masterGain) {
                this.masterGain.gain.setValueAtTime(vol, this.ctx?.currentTime || 0);
            }
            // Loop through and change volume for all HTML5 audio nodes
            for (let i = 0; i < this._howls.length; i++) {
                if (!this._howls[i]._webAudio) {
                    // Get all of the sounds in this Howl group
                    const ids = this._howls[i]._getSoundIds();
                    // Loop through all sounds and change the volumes
                    for (let j = 0; j < ids.length; j++) {
                        const sound = this._howls[i]._soundById(ids[j]);
                        if (sound?._node) {
                            sound._node.volume = sound._volume * vol;
                        }
                    }
                }
            }
            return this;
        }
        return this._volume;
    }
    /**
     * Handle muting and unmuting globally
     * @param muted Is muted or not
     * @return Self
     */
    mute(muted) {
        // If no AudioContext created yet, run the setup
        if (!this.ctx) {
            this._setupAudioContext();
        }
        this._muted = muted;
        // With Web Audio, we just need to mute the master gain
        if (this.usingWebAudio && this.masterGain) {
            this.masterGain.gain.setValueAtTime(muted ? 0 : this._volume, this.ctx?.currentTime || 0);
        }
        // Loop through and mute all HTML5 Audio nodes
        for (let i = 0; i < this._howls.length; i++) {
            if (!this._howls[i]._webAudio) {
                // Get all of the sounds in this Howl group
                const ids = this._howls[i]._getSoundIds();
                // Loop through all sounds and mark the audio node as muted
                for (let j = 0; j < ids.length; j++) {
                    const sound = this._howls[i]._soundById(ids[j]);
                    if (sound?._node) {
                        sound._node.muted = muted ? true : sound._muted;
                    }
                }
            }
        }
        return this;
    }
    /**
     * Handle stopping all sounds globally
     * @return Self
     */
    stop() {
        // Loop through all Howls and stop them
        for (let i = 0; i < this._howls.length; i++) {
            this._howls[i].stop();
        }
        return this;
    }
    /**
     * Unload and destroy all currently loaded Howl objects
     * @return Self
     */
    unload() {
        for (let i = this._howls.length - 1; i >= 0; i--) {
            this._howls[i].unload();
        }
        // Create a new AudioContext to make sure it is fully reset
        if (this.usingWebAudio && this.ctx && typeof this.ctx.close !== 'undefined') {
            this.ctx.close();
            this.ctx = null;
            this._setupAudioContext();
        }
        return this;
    }
    /**
     * Check for codec support of specific extension
     * @param ext Audio file extension
     * @return Codec support status
     */
    codecs(ext) {
        return this._codecs[ext.replace(/^x-/, '')] || false;
    }
    /**
     * Setup various state values for global tracking
     * @return Self
     */
    _setupAudioContext() {
        // Determine if we should use Web Audio or HTML5 Audio
        this.ctx = null;
        try {
            if (typeof AudioContext !== 'undefined') {
                this.ctx = new AudioContext();
            }
            else if (typeof webkitAudioContext !== 'undefined') {
                this.ctx = new webkitAudioContext();
            }
            else {
                this.usingWebAudio = false;
            }
        }
        catch (e) {
            this.usingWebAudio = false;
        }
        // Check if a webview is being used on iOS8 or earlier (rather than the browser)
        // If so, disable Web Audio as it causes crashing
        const iOS = /iP(hone|od|ad)/.test(this._navigator?.platform || '');
        const appVersion = this._navigator?.appVersion.match(/OS (\\d+)_(\\d+)_?(\\d+)?/);
        const version = appVersion ? Number.parseInt(appVersion[1], 10) : null;
        if (iOS && version && version < 9) {
            this.usingWebAudio = false;
        }
        // If the audio context has a state property, make sure it is running
        // This fixes audio playback on Chrome >= 50
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        // Setup the master GainNode
        if (this.usingWebAudio && this.ctx) {
            this.masterGain =
                typeof this.ctx.createGain === 'undefined'
                    ? this.ctx.createGainNode()
                    : this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
        }
        // Re-run the setup on Howler
        this._setupCodecs();
        // Mobile devices require a touch interaction to play audio
        // Check if any of the sounds need to be unlocked
        if (this.autoUnlock) {
            this._autoUnlock();
        }
        // Handle orientation changes and device state on iOS
        if (this.usingWebAudio && typeof document !== 'undefined') {
            // Listen for changes to audio context
            if (this.ctx && this._stateEvents.length > 0) {
                for (let i = 0; i < this._stateEvents.length; i++) {
                    this.ctx.addEventListener(this._stateEvents[i], this._handleAudioStateChange.bind(this));
                }
            }
            // Setup auto-suspend
            this._handleAutoSuspend();
            // Listen for changes in device state
            document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));
            document.addEventListener('pagehide', this._handlePageHide.bind(this));
            document.addEventListener('pageshow', this._handlePageShow.bind(this));
        }
        return this;
    }
    /**
     * Check for browser codec support
     * @return Self
     */
    _setupCodecs() {
        const testFn = (element, codec) => {
            if (!element) {
                return false;
            }
            try {
                const result = element.canPlayType(codec);
                return result !== '' && result !== 'no';
            }
            catch (e) {
                return false;
            }
        };
        const audio = typeof Audio !== 'undefined' ? new Audio() : null;
        if (!audio || typeof audio.canPlayType !== 'function') {
            this.noAudio = true;
            return this;
        }
        const mpegTest = audio.canPlayType('audio/mpeg;').replace(/^no$/, '');
        // Opera version < 33 has mixed MP3 support, so check for it
        const checkOpera = this._navigator?.userAgent.match(/OPR\/([0-6].)/g);
        const isOldOpera = checkOpera && Number.parseInt(checkOpera[0].split('/')[1], 10) < 33;
        this._codecs = {
            mp3: !!(!isOldOpera && (mpegTest || testFn(audio, 'audio/mp3;'))),
            mpeg: !!mpegTest,
            opus: !!testFn(audio, 'audio/ogg; codecs="opus"'),
            ogg: !!testFn(audio, 'audio/ogg; codecs="vorbis"'),
            oga: !!testFn(audio, 'audio/ogg; codecs="vorbis"'),
            wav: !!testFn(audio, 'audio/wav; codecs="1"'),
            aac: !!testFn(audio, 'audio/aac;'),
            caf: !!testFn(audio, 'audio/x-caf;'),
            m4a: !!(testFn(audio, 'audio/x-m4a;') ||
                testFn(audio, 'audio/m4a;') ||
                testFn(audio, 'audio/aac;')),
            m4b: !!(testFn(audio, 'audio/x-m4b;') ||
                testFn(audio, 'audio/m4b;') ||
                testFn(audio, 'audio/aac;')),
            mp4: !!(testFn(audio, 'audio/x-mp4;') ||
                testFn(audio, 'audio/mp4;') ||
                testFn(audio, 'audio/aac;')),
            weba: !!testFn(audio, 'audio/webm; codecs="vorbis"'),
            webm: !!testFn(audio, 'audio/webm; codecs="vorbis"'),
            dolby: !!testFn(audio, 'audio/mp4; codecs="ec-3"'),
            flac: !!(testFn(audio, 'audio/x-flac;') || testFn(audio, 'audio/flac;'))
        };
        return this;
    }
    /**
     * Mobile browsers will only allow audio to be played after a user interaction
     * Attempt to automatically unlock audio on the first user interaction
     * @return Self
     */
    _autoUnlock() {
        // Already verified or already unlocked
        if (!this.ctx || !this.autoUnlock || !this._navigator || !this._navigator.userAgent) {
            return this;
        }
        // Check if mobile device
        const isMobile = /iPhone|iPad|iPod|Android|BlackBerry|BB10|Silk|Mobi|Chrome|Safari/i.test(this._navigator.userAgent);
        if (!isMobile) {
            return this;
        }
        // Only run this on iOS if audio is in a pending state
        const isIOS = /iPhone|iPad|iPod/i.test(this._navigator.userAgent);
        const audioUnlocked = false;
        // Skip the unlocking on iOS if audio playback is allowed without user interaction
        if (isIOS) {
            try {
                const myAudio = new Audio();
                // If the current browser allows autoplay, skip the unlock
                myAudio.muted = true;
                const playPromise = myAudio.play();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise
                        .then(() => {
                        // Safari allowed autoplay
                        return this;
                    })
                        .catch(() => {
                        // Safari did not allow autoplay, we need to listen for user interaction
                    });
                }
            }
            catch (e) {
                // Continue with unlocking if there's an error
            }
        }
        // When interacting with the page, attempt to unlock audio
        const unlock = () => {
            // Remove the event listeners
            document.removeEventListener('touchstart', unlock, true);
            document.removeEventListener('touchend', unlock, true);
            document.removeEventListener('click', unlock, true);
            document.removeEventListener('keydown', unlock, true);
            // Create an empty buffer for unlocking
            if (this.ctx) {
                const buffer = this.ctx.createBuffer(1, 1, 22050);
                const source = this.ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(this.ctx.destination);
                // Play the empty buffer
                if (typeof source.start === 'undefined') {
                    source.noteOn(0);
                }
                else {
                    source.start(0);
                }
            }
            // Resume the audio context if it's suspended (e.g., in Chrome >= 55)
            if (this.ctx && typeof this.ctx.resume === 'function') {
                this.ctx.resume();
            }
            // Setup a timeout to check if we're unlocked
            if (this._unlockTimeout) {
                clearTimeout(this._unlockTimeout);
            }
            this._unlockTimeout = setTimeout(() => {
                // Update all sounds for the new state
                for (let i = 0; i < this._howls.length; i++) {
                    this._howls[i]._emitEvent('unlock');
                }
            }, 0);
        };
        // Setup events to unlock audio
        document.addEventListener('touchstart', unlock, true);
        document.addEventListener('touchend', unlock, true);
        document.addEventListener('click', unlock, true);
        document.addEventListener('keydown', unlock, true);
        return this;
    }
    /**
     * Handle the audio state change
     * @param e Event
     */
    _handleAudioStateChange(e) {
        // Update the suspend state
        if (e.type === 'suspended') {
            // If we want to suspend audio, keep track of it
            for (let i = 0; i < this._howls.length; i++) {
                this._howls[i]._handleSuspend();
            }
        }
        else if (e.type === 'running' && this.ctx) {
            // If we're resuming the audio, make sure we're at the right time
            const now = this.ctx.currentTime;
            // Update all Howls for the new context state
            for (let i = 0; i < this._howls.length; i++) {
                this._howls[i]._emit('resume', null, now);
            }
        }
    }
    /**
     * Auto-suspend the Web Audio AudioContext after no sound has played for 30 seconds
     * @return Self
     */
    _handleAutoSuspend() {
        if (!this.autoSuspend ||
            !this.ctx ||
            typeof this.ctx.suspend === 'undefined' ||
            !this.usingWebAudio) {
            return this;
        }
        // Check if any sounds are playing
        for (let i = 0; i < this._howls.length; i++) {
            if (this._howls[i]._webAudio) {
                for (let j = 0; j < this._howls[i]._sounds.length; j++) {
                    if (!this._howls[i]._sounds[j]._paused) {
                        return this;
                    }
                }
            }
        }
        if (this._suspendTimer) {
            clearTimeout(this._suspendTimer);
        }
        // If no sound has played after 30 seconds, suspend the context
        this._suspendTimer = setTimeout(() => {
            if (!this.autoSuspend) {
                return;
            }
            this._suspendTimer = null;
            this.state = 'suspending';
            this.ctx?.suspend().then(() => {
                this.state = 'suspended';
                if (this._resumeAfterSuspend) {
                    this._resumeAfterSuspend = undefined;
                    this._autoResume();
                }
            });
        }, 30000);
        return this;
    }
    /**
     * Automatically resume the Web Audio AudioContext when a new sound is played
     * @return Self
     */
    _autoResume() {
        if (!this.ctx || typeof this.ctx.resume === 'undefined' || !this.usingWebAudio) {
            return this;
        }
        if (this.state === 'running' && this._suspendTimer) {
            clearTimeout(this._suspendTimer);
            this._suspendTimer = null;
        }
        else if (this.state === 'suspended' ||
            (this.state === 'suspending' && this._resumeAfterSuspend)) {
            this.ctx.resume().then(() => {
                this.state = 'running';
                // Emit to all Howls that the audio has resumed
                for (let i = 0; i < this._howls.length; i++) {
                    this._howls[i]._emit('resume');
                }
            });
            if (this._suspendTimer) {
                clearTimeout(this._suspendTimer);
                this._suspendTimer = null;
            }
        }
        else if (this.state === 'suspending') {
            this._resumeAfterSuspend = true;
        }
        return this;
    }
    /**
     * Handle visibility change event
     */
    _handleVisibilityChange() {
        if (document.hidden) {
            // Suspend the audio when the page is hidden
            for (let i = 0; i < this._howls.length; i++) {
                this._howls[i]._onVisibilityChange(true);
            }
        }
        else {
            // Resume the audio when the page is shown
            for (let i = 0; i < this._howls.length; i++) {
                this._howls[i]._onVisibilityChange(false);
            }
        }
    }
    /**
     * Handle page hide event
     */
    _handlePageHide() {
        // Suspend the audio when the page is hidden
        for (let i = 0; i < this._howls.length; i++) {
            this._howls[i]._onPageHide();
        }
    }
    /**
     * Handle page show event
     */
    _handlePageShow() {
        // Resume the audio when the page is shown
        for (let i = 0; i < this._howls.length; i++) {
            this._howls[i]._onPageShow();
        }
    }
}
/**
 * Create an audio player for playing back audio files
 */
class Howl {
    /**
     * Create a new Howl instance
     * @param options Configuration options
     */
    constructor(options) {
        // Additional properties to make TypeScript happy
        this._format = null;
        // Setup the defaults
        this._autoplay = options.autoplay || false;
        this._format = typeof options.format !== 'string' ? options.format : [options.format];
        this._html5 = options.html5 || false;
        this._muted = options.mute || false;
        this._loop = options.loop || false;
        this._pool = options.pool || 5;
        this._preload = options.preload === undefined ? true : options.preload;
        this._rate = options.rate || 1;
        this._sprite = options.sprite || {};
        this._src = typeof options.src !== 'string' ? options.src : [options.src];
        this._volume = options.volume !== undefined ? options.volume : 1;
        this._xhr = null;
        this._xhrWithCredentials = options.xhrWithCredentials || false;
        // Setup event listeners
        this._onend = [];
        this._onfade = [];
        this._onload = [];
        this._onloaderror = [];
        this._onplayerror = [];
        this._onpause = [];
        this._onplay = [];
        this._onstop = [];
        this._onmute = [];
        this._onvolume = [];
        this._onrate = [];
        this._onseek = [];
        this._onunlock = [];
        this._onresume = [];
        // Add user-defined event listeners
        this._onend.push(options.onend || (() => { }));
        this._onload.push(options.onload || (() => { }));
        this._onloaderror.push(options.onloaderror || (() => { }));
        this._onplayerror.push(options.onplayerror || (() => { }));
        this._onpause.push(options.onpause || (() => { }));
        this._onplay.push(options.onplay || (() => { }));
        this._onstop.push(options.onstop || (() => { }));
        this._onmute.push(options.onmute || (() => { }));
        this._onvolume.push(options.onvolume || (() => { }));
        this._onrate.push(options.onrate || (() => { }));
        this._onseek.push(options.onseek || (() => { }));
        this._onfade.push(options.onfade || (() => { }));
        this._onunlock.push(options.onunlock || (() => { }));
        // Internal properties
        this._state = 'unloaded';
        this._sounds = [];
        this._endTimers = {};
        this._queue = [];
        this._playLock = false;
        this._duration = 0;
        this._formats = null;
        this._loaded = false;
        this._pos = 0;
        this._webAudio = Howler.usingWebAudio && !this._html5;
        // Determine if we should attempt to use Web Audio
        if (this._html5) {
            this._webAudio = false;
        }
        // Add this to the global Howler object
        Howler._howls.push(this);
        // If audio is disabled, we skip loading
        if (Howler.noAudio) {
            this._onloaderror[0](0, 'No audio support');
            return;
        }
        // Begin loading the source
        if (this._preload) {
            this.load();
        }
    }
    /**
     * Load the audio file
     * @return Self
     */
    load() {
        // If the audio is already loaded, do nothing
        if (this._loaded || this._state === 'loading') {
            return this;
        }
        // Make sure we only load once
        this._state = 'loading';
        // If HTML5 Audio is being used, load the file
        if (this._html5) {
            this._loadHtml5();
        }
        else {
            this._loadBuffer();
        }
        return this;
    }
    /**
     * Load using Web Audio API
     * @return Self
     */
    _loadBuffer() {
        // Get the most supported file format
        if (!this._formats) {
            this._formats = [];
            for (let i = 0; i < this._src.length; i++) {
                const ext = this._src[i].split('.').pop() || '';
                const format = ext.toLowerCase();
                if (this._formats.indexOf(format) === -1) {
                    this._formats.push(format);
                }
            }
        }
        // Choose the most supported file format
        let source = null;
        for (let i = 0; i < this._formats.length; i++) {
            if (Howler.codecs(this._formats[i])) {
                for (let j = 0; j < this._src.length; j++) {
                    if (this._src[j].split('.').pop()?.toLowerCase() === this._formats[i]) {
                        source = this._src[j];
                        break;
                    }
                }
                if (source) {
                    break;
                }
            }
        }
        // If no supported source was found, error out
        if (!source) {
            this._emit('loaderror', null, 'No codec support for selected audio sources.');
            return this;
        }
        // Load the file using XHR
        this._src = source;
        this._xhr = new XMLHttpRequest();
        // Setup the XHR request
        const xhr = this._xhr;
        xhr.open('GET', source, true);
        xhr.withCredentials = this._xhrWithCredentials;
        xhr.responseType = 'arraybuffer';
        // Listen for events
        xhr.onload = () => {
            // Check for successful response
            if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
                this._loadFromArrayBuffer(xhr.response);
            }
            else {
                this._emit('loaderror', null, `Failed loading audio file: ${source}`);
            }
        };
        xhr.onerror = () => {
            this._emit('loaderror', null, `Failed loading audio file: ${source}`);
        };
        xhr.onprogress = (event) => {
            // Fire progress event
            if (event.lengthComputable) {
                this._emit('loadprogress', null, event.loaded / event.total);
            }
        };
        xhr.send();
        return this;
    }
    /**
     * Process the result from an XMLHttpRequest and decode the audio
     * @param arraybuffer The ArrayBuffer from the XHR
     */
    _loadFromArrayBuffer(arraybuffer) {
        if (!Howler.ctx) {
            return;
        }
        // Decode the arraybuffer using Web Audio
        Howler.ctx.decodeAudioData(arraybuffer, (buffer) => {
            if (buffer && this._state === 'loading') {
                // Set the duration
                this._duration = buffer.duration;
                // Create a source buffer and connect it to master gain node
                this._setupAudioNode(buffer);
                // Mark as loaded
                this._state = 'loaded';
                this._loaded = true;
                // Emit the loaded event
                this._emit('load');
                // Process the queue of actions
                this._loadQueue();
            }
        }, (err) => {
            this._emit('loaderror', null, err);
        });
    }
    /**
     * Creates an audio node from a buffer
     * @param buffer The decoded audio buffer
     */
    _setupAudioNode(buffer) {
        // Create a new sound instance with this buffer
        const sound = {
            id: Howler._counter++,
            _buffer: buffer,
            _webAudio: true,
            _paused: true,
            _ended: true,
            _muted: false,
            _volume: this._volume,
            _rate: this._rate,
            _duration: this._duration,
            _seek: 0,
            _pos: 0,
            _sprite: '__default',
            _loop: this._loop,
            _parent: this,
            _fading: null,
            _node: null
        };
        // Add this sound to the array of sounds
        this._sounds.push(sound);
        // If autoplay is enabled, play this sound
        if (this._autoplay) {
            this.play(sound.id);
        }
    }
    /**
     * Load using HTML5 Audio
     * @return Self
     */
    _loadHtml5() {
        // Loop through source URLs and pick the first supported one
        let source = null;
        // Check for file format support
        for (let i = 0; i < this._src.length; i++) {
            const ext = this._src[i].split('.').pop() || '';
            if (Howler.codecs(ext)) {
                source = this._src[i];
                break;
            }
        }
        // If no supported source was found, error out
        if (!source) {
            this._emit('loaderror', null, 'No codec support for selected audio sources.');
            return this;
        }
        this._src = source;
        // Create a new HTML5 Audio element
        const node = new Audio();
        node.autoplay = false;
        node.preload = this._preload === true ? "auto" : (typeof this._preload === "string" ? this._preload : "auto");
        // Handle cross-domain URLs
        node.crossOrigin = 'anonymous';
        // Setup event listeners
        const errorFn = () => {
            // Clear event listeners
            node.removeEventListener('error', errorFn);
            node.removeEventListener(Howler._canPlayEvent, loadFn);
            // Emit the error
            this._emit('loaderror', null, `Failed loading audio file: ${source}`);
        };
        const loadFn = () => {
            // Clear event listeners
            node.removeEventListener('error', errorFn);
            node.removeEventListener(Howler._canPlayEvent, loadFn);
            // IOS 17.4 PATCH
            node.removeEventListener('loadedmetadata', loadFn);
            node.removeEventListener('suspend', setAudioNodeWasSuspendedFromEvent);
            // Setup the new sound
            this._setupSound(node);
        };
        // Add error listener
        node.addEventListener('error', errorFn);
        node.addEventListener(Howler._canPlayEvent, loadFn);
        // IOS 17.4 PATCH
        node.addEventListener('loadedmetadata', loadFn);
        node._wasSuspended = false;
        node.addEventListener('suspend', setAudioNodeWasSuspendedFromEvent);
        // Set the source
        node.src = source;
        // Begin loading
        node.load();
        return this;
    }
    /**
     * Setup a new HTML5 Audio instance
     * @param node HTML5 Audio element
     */
    _setupSound(node) {
        // Create a new sound object
        const sound = {
            id: Howler._counter++,
            _node: node,
            _webAudio: false,
            _paused: true,
            _ended: true,
            _muted: false,
            _volume: this._volume,
            _rate: this._rate,
            _duration: node.duration || 0,
            _seek: 0,
            _pos: 0,
            _sprite: '__default',
            _loop: this._loop,
            _parent: this,
            _fading: null
        };
        // Add the sound to the array
        this._sounds.push(sound);
        // Set the duration
        if (node.duration > 0) {
            this._duration = node.duration;
        }
        // Update the state
        this._state = 'loaded';
        this._loaded = true;
        // Emit the loaded event
        this._emit('load');
        // Process the queue
        this._loadQueue();
        // If autoplay, play the sound
        if (this._autoplay) {
            this.play(sound.id);
        }
    }
    /**
     * Process the queue of actions that were initiated while audio was still loading
     * @return Self
     */
    _loadQueue() {
        if (this._state !== 'loaded') {
            return this;
        }
        // Execute all queued actions
        for (let i = 0; i < this._queue.length; i++) {
            this._queue[i]();
        }
        // Clear the queue
        this._queue = [];
        return this;
    }
    /**
     * Play a sound or multiple sounds
     * @param sprite Named sprite to play (optional)
     * @param callback Callback to call when sound is complete (optional)
     * @return Sound ID or list of Sound IDs
     */
    play(sprite, callback) {
        // If sprite is actually the callback, shift arguments
        if (typeof sprite === 'function') {
            callback = sprite;
            sprite = undefined;
        }
        // If no sprite specified, use default
        if (typeof sprite === 'undefined') {
            sprite = '__default';
        }
        // If sound hasn't loaded, add to queue
        if (this._state !== 'loaded') {
            // Add to the queue of actions to perform when sound is loaded
            this._queue.push(() => {
                return this.play(sprite, callback);
            });
            return typeof sprite === 'string' ? this._sounds[0]?.id || 0 : this._sounds[0]?.id || 0;
        }
        // If the sprite doesn't exist, play nothing
        if (typeof sprite === 'string' && !this._sprite[sprite]) {
            if (callback) {
                callback();
            }
            return 0;
        }
        // Handle playing multiple instances if needed
        if (typeof sprite === 'number') {
            // Get the sound
            const sound = this._soundById(sprite);
            // If the sound doesn't exist or is already playing, do nothing
            if (!sound) {
                return 0;
            }
            // Setup the callback
            if (callback) {
                sound._onend = callback;
            }
            // Play the sound
            this._playSound(sound);
            return sound.id;
        }
        // Play all of the sounds with this sprite
        const ids = [];
        // Loop through all sounds and play them
        for (let i = 0; i < this._sounds.length; i++) {
            // Get the sound
            const sound = this._sounds[i];
            // If the sound is already playing or all instances are used, skip it
            if (sound._paused && !sound._ended) {
                continue;
            }
            // Determine how long the sound should play
            const spriteData = typeof sprite === 'string' ? this._sprite[sprite] : null;
            if (spriteData) {
                sound._sprite = sprite;
                // Get the start and end times from the sprite
                const start = spriteData[0] / 1000;
                const end = spriteData[1] / 1000;
                // Set the duration to the difference
                sound._duration = end - start;
                // Set loop if specified in the sprite
                if (spriteData.length > 2) {
                    sound._loop = !!spriteData[2];
                }
                // Update the parameters of the sound
                sound._pos = start;
                sound._seek = 0;
            }
            // Set the callback
            if (callback) {
                sound._onend = callback;
            }
            // Add the sound ID to the array
            ids.push(sound.id);
            // Play the sound
            this._playSound(sound);
        }
        return ids.length > 1 ? ids : ids[0];
    }
    /**
     * Actually play a sound
     * @param sound Sound object to play
     */
    _playSound(sound) {
        // If the sound is already playing, do nothing
        if (!sound._paused) {
            return;
        }
        // If using Web Audio
        if (sound._webAudio) {
            // Resume the AudioContext if it's suspended
            Howler._autoResume();
            // Setup the gain node
            sound._gainNode = Howler.ctx.createGain();
            sound._gainNode.gain.setValueAtTime(sound._muted ? 0 : sound._volume, Howler.ctx.currentTime);
            sound._gainNode.connect(Howler.masterGain);
            // Create the source node
            sound._node = Howler.ctx.createBufferSource();
            sound._node.buffer = sound._buffer;
            // Set the playback rate
            sound._node.playbackRate.setValueAtTime(sound._rate, Howler.ctx.currentTime);
            // Connect the source to the gain node
            sound._node.connect(sound._gainNode);
            // Setup the end event
            sound._node.onended = () => {
                this._ended(sound);
            };
            // If the sound is looped, set it up
            if (sound._loop) {
                sound._node.loop = true;
                sound._node.loopStart = sound._pos;
                sound._node.loopEnd = sound._pos + sound._duration;
            }
            // Start the playback
            sound._node.start(Howler.ctx.currentTime, sound._pos, sound._loop ? 999999999 : sound._duration);
            // Store playback start time
            sound._playStart = Howler.ctx.currentTime;
            // Update the state
            sound._paused = false;
            sound._ended = false;
            // Emit the play event
            this._emit('play', sound.id);
        }
        else {
            // Using HTML5 Audio
            // Resume the AudioContext if it's suspended
            Howler._autoResume();
            // Check if the sound is ready to play
            if (!sound._node.paused || sound._node.currentTime !== sound._pos) {
                // Reset the node
                sound._node.currentTime = sound._pos;
            }
            // Update the volume
            sound._node.volume = sound._muted ? 0 : sound._volume;
            // Update the playback rate
            if (sound._node instanceof HTMLAudioElement) {
                sound._node.playbackRate = sound._rate;
            }
            else if (sound._node?.playbackRate instanceof AudioParam) {
                sound._node.playbackRate.setValueAtTime(sound._rate, Howler.ctx?.currentTime || 0);
            }
            // IOS 17.4 PATCH
            if (sound._node.networkState === 1 && sound._node._wasSuspended) {
                sound._node.play();
            }
            else {
                // Play the sound
                try {
                    const promise = sound._node.play();
                    // Handle promise (for Chrome's autoplay policy)
                    if (promise && typeof promise.catch === 'function') {
                        promise.catch((err) => {
                            // Emit the error
                            if (sound.id === this._sounds[0].id) {
                                this._emit('playerror', sound.id, err);
                            }
                        });
                    }
                }
                catch (err) {
                    // Emit the error
                    this._emit('playerror', sound.id, err);
                }
            }
            // Update the state
            sound._paused = false;
            sound._ended = false;
            // Emit the play event
            this._emit('play', sound.id);
        }
    }
    /**
     * Pause playback and save current position
     * @param id The sound ID (leave empty to pause all sounds)
     * @return Self
     */
    pause(id) {
        // If id is not provided, get all sound IDs
        if (typeof id === 'undefined') {
            // Pause all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                this.pause(this._sounds[i].id);
            }
            return this;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist or is already paused, do nothing
        if (!sound || sound._paused) {
            return this;
        }
        // Mark as paused
        sound._paused = true;
        sound._ended = false;
        // If using Web Audio
        if (sound._webAudio) {
            // Stop the source
            if (sound._node?.bufferSource) {
                sound._node.bufferSource.stop(Howler.ctx.currentTime);
            }
        }
        else {
            // Pause the HTML5 Audio
            if (sound._node && !sound._node.paused) {
                sound._node.pause();
            }
        }
        // Clear any timers
        this._clearTimer(id);
        // Emit the pause event
        this._emit('pause', id);
        return this;
    }
    /**
     * Stop playback and reset to start
     * @param id The sound ID (leave empty to stop all sounds)
     * @return Self
     */
    stop(id) {
        // If id is not provided, get all sound IDs
        if (typeof id === 'undefined') {
            // Stop all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                if (!this._sounds[i]._paused) {
                    this.stop(this._sounds[i].id);
                }
            }
            return this;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, do nothing
        if (!sound) {
            return this;
        }
        // Reset the sound
        sound._paused = true;
        sound._ended = true;
        sound._seek = 0;
        sound._pos = 0;
        // If using Web Audio
        if (sound._webAudio) {
            // Stop the source
            if (sound._node?.bufferSource) {
                sound._node.bufferSource.stop(Howler.ctx.currentTime);
            }
        }
        else {
            // Stop the HTML5 Audio
            if (sound._node && !sound._node.paused) {
                sound._node.pause();
                sound._node.currentTime = 0;
            }
        }
        // Clear any timers
        this._clearTimer(id);
        // Emit the stop event
        this._emit('stop', id);
        return this;
    }
    /**
     * Mute/unmute a single sound or all sounds
     * @param muted True to mute and false to unmute
     * @param id The sound ID (leave empty to mute all sounds)
     * @return Self
     */
    mute(muted, id) {
        // If id is not provided, mute all sounds
        if (typeof id === 'undefined') {
            // Update the mute status
            this._muted = muted;
            // Mute all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                this._sounds[i]._muted = muted;
                // Update the sound
                if (this._sounds[i]._node) {
                    if (this._webAudio) {
                        if (this._sounds[i]._gainNode) {
                            this._sounds[i]._gainNode.gain.setValueAtTime(muted ? 0 : this._sounds[i]._volume * Howler._volume, Howler.ctx.currentTime);
                        }
                    }
                    else {
                        this._sounds[i]._node.volume = muted ? 0 : this._sounds[i]._volume * Howler._volume;
                    }
                }
            }
            // Emit the mute event
            this._emit('mute', muted);
            return this;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, do nothing
        if (!sound) {
            return this;
        }
        // Update the mute status
        sound._muted = muted;
        // Update the sound
        if (sound._node) {
            if (this._webAudio) {
                if (sound._gainNode) {
                    sound._gainNode.gain.setValueAtTime(muted ? 0 : sound._volume * Howler._volume, Howler.ctx.currentTime);
                }
            }
            else {
                sound._node.volume = muted ? 0 : sound._volume * Howler._volume;
            }
        }
        // Emit the mute event
        this._emit('mute', id);
        return this;
    }
    /**
     * Get/set volume of this sound or the master volume
     * @param vol Volume from 0.0 to 1.0
     * @param id The sound ID (leave empty to change master volume)
     * @return Self or volume
     */
    volume(vol, id) {
        // If id is not provided and vol is, change global volume
        if (typeof vol === 'number' && typeof id === 'undefined') {
            // Update the volume
            this._volume = Math.max(0, Math.min(1, vol));
            // Change the volume for all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                // Only update if not muted
                if (!this._sounds[i]._muted) {
                    if (this._webAudio) {
                        if (this._sounds[i]._gainNode) {
                            this._sounds[i]._gainNode.gain.setValueAtTime(vol * Howler._volume, Howler.ctx.currentTime);
                        }
                    }
                    else {
                        this._sounds[i]._node.volume = vol * Howler._volume;
                    }
                }
            }
            return this;
        }
        // Get a sound and return its volume
        if (typeof id === 'undefined') {
            return this._volume;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, do nothing
        if (!sound) {
            return this;
        }
        // If vol is passed, set the volume
        if (typeof vol !== 'undefined') {
            // Update the volume
            sound._volume = Math.max(0, Math.min(1, vol));
            // Only update if not muted
            if (!sound._muted) {
                if (this._webAudio) {
                    if (sound._gainNode) {
                        sound._gainNode.gain.setValueAtTime(sound._volume * Howler._volume, Howler.ctx.currentTime);
                    }
                }
                else {
                    sound._node.volume = sound._volume * Howler._volume;
                }
            }
            // Emit the volume event
            this._emit('volume', id);
            return this;
        }
        // Return the sound volume
        return sound._volume;
    }
    /**
     * Get/set the playback rate
     * @param rate Playback rate (0.5 to 4.0, where 1.0 is normal speed)
     * @param id The sound ID (leave empty to change all sounds)
     * @return Self or playback rate
     */
    rate(rate, id) {
        // If id is not provided and rate is, change rate for all sounds
        if (typeof rate === 'number' && typeof id === 'undefined') {
            // Update the rate
            this._rate = Math.max(0.5, Math.min(4, rate));
            // Change the rate for all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                // Update the rate
                this._sounds[i]._rate = rate;
                // Only update if playing
                if (!this._sounds[i]._paused) {
                    if (this._webAudio) {
                        if (this._sounds[i]._node?.bufferSource) {
                            this._sounds[i]._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
                        }
                    }
                    else {
                        if (this._sounds[i]._node instanceof HTMLAudioElement) {
                            this._sounds[i]._node.playbackRate = rate;
                        }
                    }
                }
            }
            return this;
        }
        // Get a sound and return its rate
        if (typeof id === 'undefined') {
            return this._rate;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, do nothing
        if (!sound) {
            return this;
        }
        // If rate is passed, set the rate
        if (typeof rate !== 'undefined') {
            // Update the rate
            sound._rate = Math.max(0.5, Math.min(4, rate));
            // Only update if playing
            if (!sound._paused) {
                if (this._webAudio) {
                    if (sound._node?.bufferSource) {
                        sound._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
                    }
                }
                else {
                    if (sound._node instanceof HTMLAudioElement) {
                        sound._node.playbackRate = rate;
                    }
                }
            }
            // Emit the rate event
            this._emit('rate', id);
            return this;
        }
        // Return the sound rate
        return sound._rate;
    }
    /**
     * Get/set the seek position of a sound
     * @param seek The position to seek to in seconds
     * @param id The sound ID (leave empty to change all sounds)
     * @return Self or current seek position
     */
    seek(seek, id) {
        // If id is not provided, get the first sound
        if (typeof id === 'undefined') {
            if (this._sounds.length) {
                id = this._sounds[0].id;
            }
            else {
                return 0;
            }
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, do nothing
        if (!sound) {
            return 0;
        }
        // If the audio is still loading, add it to the queue
        if (this._state !== 'loaded') {
            // Add to the queue of actions to perform when sound is loaded
            this._queue.push(() => {
                return this.seek(seek, id);
            });
            return this;
        }
        // If seek is passed, set the new position
        if (typeof seek !== 'undefined' && !Number.isNaN(seek)) {
            // Make sure we're not seeking past the end
            seek = Math.max(0, Math.min(sound._duration, seek));
            // Update the seek position
            sound._seek = seek;
            sound._pos = seek;
            // Update the sound
            if (sound._node) {
                if (this._webAudio) {
                    // Stop and restart the audio with the new position
                    if (!sound._paused) {
                        this.pause(id).play(id);
                    }
                }
                else {
                    sound._node.currentTime = seek;
                }
            }
            // Emit the seek event
            this._emit('seek', id);
            return this;
        }
        // Return the sound position
        if (sound._paused || sound._ended) {
            return sound._seek;
        }
        // Get the current position
        let pos = 0;
        if (this._webAudio) {
            pos = (Howler.ctx.currentTime - sound._playStart) * sound._rate;
            if (pos > sound._duration) {
                pos = sound._duration;
            }
        }
        else {
            pos = sound._node.currentTime;
        }
        return pos;
    }
    /**
     * Check if a specific sound is currently playing or not
     * @param id The sound ID to check
     * @return True if playing and false if not
     */
    playing(id) {
        // If id is not provided, check if any sounds are playing
        if (typeof id === 'undefined') {
            // Loop through all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                // If any sound is playing, return true
                if (!this._sounds[i]._paused) {
                    return true;
                }
            }
            // If we get here, no sounds are playing
            return false;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist or is paused, return false
        return sound ? !sound._paused : false;
    }
    /**
     * Get the duration of the audio source
     * @param id The sound ID to check
     * @return Audio duration in seconds
     */
    duration(id) {
        // If id is not provided, return the group duration
        if (typeof id === 'undefined') {
            // Return the cached duration
            return this._duration;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, return 0
        return sound ? sound._duration : 0;
    }
    state(id) {
        // If id is not provided, return the group state
        if (typeof id === 'undefined') {
            return this._state;
        }
        // Get the sound
        const sound = this._soundById(id);
        // If the sound doesn't exist, return null
        if (!sound) {
            return 'stopped';
        }
        // Return the sound state
        if (sound._paused) {
            return 'paused';
        }
        if (!sound._paused && !sound._ended) {
            return 'playing';
        }
        return 'stopped';
    }
    /**
     * Unload and destroy the current Howl object
     * This will immediately stop all sound instances attached to this group
     * @return Self for chaining
     */
    unload() {
        // Stop all sounds
        this.stop();
        // If using Web Audio, disconnect from the context
        if (this._webAudio) {
            for (let i = 0; i < this._sounds.length; i++) {
                const sound = this._sounds[i];
                // Remove any event listeners
                this._cleanBuffer(sound);
                // Remove the source node
                if (sound._node) {
                    if (sound._node instanceof AudioBufferSourceNode) {
                        sound._node.disconnect(0);
                    }
                }
                // Remove the gain node
                if (sound._gainNode) {
                    sound._gainNode.disconnect(0);
                }
            }
        }
        else {
            // Loop through all sounds and clean up HTML5 Audio
            for (let i = 0; i < this._sounds.length; i++) {
                const sound = this._sounds[i];
                // Remove any event listeners
                if (sound._node) {
                    sound._node.removeEventListener('error', sound._errorFn, false);
                    sound._node.removeEventListener(Howler._canPlayEvent, sound._loadFn, false);
                    // IOS17.4 PATCH
                    sound._node.removeEventListener('loadedmetadata', sound._loadFn, false);
                    sound._node.removeEventListener('suspend', setAudioNodeWasSuspendedFromEvent, false);
                    sound._node.removeEventListener('ended', sound._endFn, false);
                    // Clear the audio node
                    sound._node = null;
                }
            }
            // Clear the HTML5 Audio pool
            if (Howler._howls.indexOf(this) >= 0) {
                Howler._howls.splice(Howler._howls.indexOf(this), 1);
            }
        }
        // Clear all timers
        this._endTimers = {};
        // Clear the queue
        this._queue = [];
        // Clear 'onend' timer
        this._onend = [];
        // Set the state
        this._state = 'unloaded';
        this._sounds = [];
        return this;
    }
    /**
     * Listen to a custom event
     * @param event Event name
     * @param fn Listener to call
     * @param id ID of sound to attach to (optional)
     * @return Self
     */
    on(event, fn, id) {
        const events = this[`_on${event}`];
        if (typeof fn === 'function') {
            // Add the event to the array
            events.push(id ? { id: id, fn: fn } : { id: null, fn: fn });
        }
        return this;
    }
    /**
     * Remove a custom event
     * @param event Event name
     * @param fn Listener to remove
     * @param id ID of sound to remove from
     * @return Self
     */
    off(event, fn, id) {
        const events = this[`_on${event}`];
        // Loop through event store and remove the listeners
        if (fn) {
            for (let i = 0; i < events.length; i++) {
                // If the listener matches
                if (events[i].fn === fn && (typeof id === 'undefined' || events[i].id === id)) {
                    // Remove the listener
                    events.splice(i, 1);
                    break;
                }
            }
        }
        else if (event) {
            // Clear all events of this type
            this[`_on${event}`] = [];
        }
        else {
            // Clear all events
            const keys = Object.keys(this);
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].indexOf('_on') === 0 && Array.isArray(this[keys[i]])) {
                    this[keys[i]] = [];
                }
            }
        }
        return this;
    }
    /**
     * Emit an event to all listeners
     * @param event Event name
     * @param soundId ID of sound
     * @param message Additional message to pass
     * @return Self
     */
    _emit(event, soundId, message) {
        // If event doesn't exist, do nothing
        if (!this[`_on${event}`]) {
            return this;
        }
        // Loop through all listeners
        for (let i = this[`_on${event}`].length - 1; i >= 0; i--) {
            // Get the listener
            const listener = this[`_on${event}`][i];
            // If no ID was specified or the IDs match
            if (!listener.id || listener.id === soundId) {
                // Call the listener
                setTimeout(() => {
                    listener.fn.call(this, soundId, message);
                }, 0);
            }
        }
        return this;
    }
    /**
     * Emit event for all sounds within group on specific event
     * @param event Event name
     * @param message Additional message to pass
     * @return Self
     */
    _emitEvent(event, message) {
        // If event doesn't exist, do nothing
        if (!this[`_on${event}`]) {
            return this;
        }
        // Loop through all listeners
        for (let i = this[`_on${event}`].length - 1; i >= 0; i--) {
            // Get the listener
            const listener = this[`_on${event}`][i];
            // Call the listener
            setTimeout(() => {
                listener.fn.call(this, null, message);
            }, 0);
        }
        return this;
    }
    /**
     * Clear the end timer for a sound playback
     * @param id The sound ID
     * @return Self
     */
    _clearTimer(id) {
        // If the timer exists, clear it
        if (this._endTimers[id]) {
            // Clear the timeout
            clearTimeout(this._endTimers[id]);
            // Remove the timer
            delete this._endTimers[id];
        }
        return this;
    }
    /**
     * Handle the end of a sound's playback
     * @param sound Sound object
     * @return Nothing
     */
    _ended(sound) {
        // If using HTML5 Audio
        if (!sound._webAudio) {
            // Reset the sound
            sound._node.removeEventListener('ended', sound._endFn, false);
            sound._node.currentTime = 0;
            sound._node.pause();
            // Fix for mobile browsers
            if (sound._node.duration === Number.POSITIVE_INFINITY) {
                sound._node.duration = 0;
            }
        }
        // Mark as ended
        sound._paused = true;
        sound._ended = true;
        sound._seek = 0;
        // Emit the end event
        this._emit('end', sound.id);
        // Clear the end timer
        this._clearTimer(sound.id);
        // If autoplay is enabled, play the next sound
        if (this._loop && !sound._loop) {
            this.play(sound.id);
        }
    }
    /**
     * Find the first available sound in the group
     * @return Sound object or null
     */
    _inactiveSound() {
        // Find the first inactive sound
        for (let i = 0; i < this._sounds.length; i++) {
            // If the sound is not playing and not already loading
            if (this._sounds[i]._ended || !this._sounds[i]._loaded) {
                return this._sounds[i];
            }
        }
        // If no inactive sound is found, create a new one
        if (this._webAudio && this._sounds.length < this._pool) {
            return this._createSound();
        }
        // If we don't have enough sounds, do nothing
        return null;
    }
    /**
     * Create a new sound object
     * @return Sound object
     */
    _createSound() {
        // Create a new sound
        const sound = {
            id: Howler._counter++,
            _webAudio: this._webAudio,
            _paused: true,
            _ended: true,
            _muted: this._muted,
            _volume: this._volume,
            _rate: this._rate,
            _duration: this._duration,
            _seek: 0,
            _pos: 0,
            _sprite: '__default',
            _loop: this._loop,
            _parent: this,
            _fading: null,
            _node: null
        };
        // Add the sound to the array
        this._sounds.push(sound);
        return sound;
    }
    /**
     * Get a sound by ID
     * @param id Sound ID
     * @return Sound object or null
     */
    _soundById(id) {
        // Find the sound
        for (let i = 0; i < this._sounds.length; i++) {
            if (id === this._sounds[i].id) {
                return this._sounds[i];
            }
        }
        return null;
    }
    /**
     * Get a sound's duration
     * @return Array of all sound IDs
     */
    _getSoundIds() {
        // Get all sound IDs
        const ids = [];
        for (let i = 0; i < this._sounds.length; i++) {
            ids.push(this._sounds[i].id);
        }
        return ids;
    }
    /**
     * Clean up the buffer nodes when a sound is stopped or ended
     * @param sound Sound object
     * @return Nothing
     */
    _cleanBuffer(sound) {
        // If the source exists, disconnect it
        if (Howler.ctx && sound._node && sound._node.bufferSource) {
            sound._node.bufferSource.disconnect(0);
            try {
                sound._node.bufferSource = undefined;
            }
            catch (err) {
                sound._node.bufferSource = null;
            }
        }
        return this;
    }
    /**
     * Handle suspend events from the AudioContext
     * @return Nothing
     */
    _handleSuspend() {
        // Loop through all sounds
        for (let i = 0; i < this._sounds.length; i++) {
            // Get the sound
            const sound = this._sounds[i];
            // If the sound is playing
            if (!sound._paused && !sound._ended) {
                // Mark the start time
                sound._suspendStart = Howler.ctx?.currentTime || 0;
                // Stop the sound
                this._cleanBuffer(sound);
            }
        }
    }
    /**
     * Handle resume events from the AudioContext
     * @param time Current time in seconds
     * @return Nothing
     */
    _handleResume(time) {
        // Loop through all sounds
        for (let i = 0; i < this._sounds.length; i++) {
            // Get the sound
            const sound = this._sounds[i];
            // If the sound was suspended
            if (sound._suspendStart) {
                // Update the seek position
                sound._pos += sound._suspendStart - time;
                // Reset the start time
                sound._suspendStart = undefined;
                // Resume the sound
                this.pause(sound.id).play(sound.id);
            }
        }
    }
    /**
     * Handle visibility change event
     * @param hidden Whether the page is hidden
     * @return Nothing
     */
    _onVisibilityChange(hidden) {
        // If the page is hidden
        if (hidden) {
            // Loop through all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                // If audio is playing
                if (!this._sounds[i]._paused) {
                    // Set the suspend time
                    this._sounds[i]._visibilityPause = true;
                    this.pause(this._sounds[i].id);
                }
            }
        }
        else {
            // Loop through all sounds
            for (let i = 0; i < this._sounds.length; i++) {
                // If audio was paused by visibility
                if (this._sounds[i]._visibilityPause) {
                    // Reset the flag
                    this._sounds[i]._visibilityPause = undefined;
                    // Resume the sound
                    this.play(this._sounds[i].id);
                }
            }
        }
    }
    /**
     * Handle page hide event
     * @return Nothing
     */
    _onPageHide() {
        // Loop through all sounds
        for (let i = 0; i < this._sounds.length; i++) {
            // If audio is playing
            if (!this._sounds[i]._paused) {
                // Set the suspend time
                this._sounds[i]._pageHide = true;
                this.pause(this._sounds[i].id);
            }
        }
    }
    /**
     * Handle page show event
     * @return Nothing
     */
    _onPageShow() {
        // Loop through all sounds
        for (let i = 0; i < this._sounds.length; i++) {
            // If audio was paused by page hide
            if (this._sounds[i]._pageHide) {
                // Reset the flag
                this._sounds[i]._pageHide = undefined;
                // Resume the sound
                this.play(this._sounds[i].id);
            }
        }
    }
}
// Create the global howler instance
const Howler = new HowlerGlobal();
// Set the IOSWasSuspendHandler helper function
const setAudioNodeWasSuspendedFromEvent = (event) => {
    if (event.target) {
        event.target._wasSuspended = true;
    }
};
// Export the Howler object to the window to maintain compatibility
if (typeof window !== 'undefined') {
    window.HowlerGlobal = HowlerGlobal;
    window.Howler = Howler;
}
export { HowlerGlobal, Howler, Howl };
//# sourceMappingURL=howler.core.js.map