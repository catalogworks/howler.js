// src/howler.core.ts
class HowlerGlobal {
  _counter;
  _html5AudioPool;
  html5PoolSize;
  _codecs;
  _howls;
  _muted;
  _volume;
  _canPlayEvent;
  _navigator;
  masterGain;
  noAudio;
  usingWebAudio;
  autoSuspend;
  ctx;
  autoUnlock;
  _stateEvents;
  _unlockTimeout;
  constructor() {
    this.init();
  }
  init() {
    this._counter = 1000;
    this._html5AudioPool = [];
    this.html5PoolSize = 10;
    this._codecs = {};
    this._howls = [];
    this._muted = false;
    this._volume = 1;
    this._canPlayEvent = "canplaythrough";
    this._navigator = typeof window !== "undefined" && window.navigator ? window.navigator : null;
    this._stateEvents = ["running", "suspended"];
    this._unlockTimeout = null;
    this.masterGain = null;
    this.noAudio = false;
    this.usingWebAudio = true;
    this.autoSuspend = true;
    this.ctx = null;
    this.autoUnlock = true;
    this._setupAudioContext();
    return this;
  }
  volume(vol) {
    if (!this.ctx) {
      this._setupAudioContext();
    }
    if (typeof vol !== "undefined" && vol >= 0 && vol <= 1) {
      this._volume = vol;
      if (this._muted) {
        return this;
      }
      if (this.usingWebAudio && this.masterGain) {
        this.masterGain.gain.setValueAtTime(vol, this.ctx?.currentTime || 0);
      }
      for (let i = 0;i < this._howls.length; i++) {
        if (!this._howls[i]._webAudio) {
          const ids = this._howls[i]._getSoundIds();
          for (let j = 0;j < ids.length; j++) {
            const sound = this._howls[i]._soundById(ids[j]);
            if (sound?._node) {
              setVolume(sound._node, sound._volume * vol);
            }
          }
        }
      }
      return this;
    }
    return this._volume;
  }
  mute(muted) {
    if (!this.ctx) {
      this._setupAudioContext();
    }
    this._muted = muted;
    if (this.usingWebAudio && this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this._volume, this.ctx?.currentTime || 0);
    }
    for (let i = 0;i < this._howls.length; i++) {
      if (!this._howls[i]._webAudio) {
        const ids = this._howls[i]._getSoundIds();
        for (let j = 0;j < ids.length; j++) {
          const sound = this._howls[i]._soundById(ids[j]);
          if (sound?._node) {
            sound._node.muted = muted ? true : sound._muted;
          }
        }
      }
    }
    return this;
  }
  stop() {
    for (let i = 0;i < this._howls.length; i++) {
      this._howls[i].stop();
    }
    return this;
  }
  unload() {
    for (let i = this._howls.length - 1;i >= 0; i--) {
      this._howls[i].unload();
    }
    if (this.usingWebAudio && this.ctx && typeof this.ctx.close !== "undefined") {
      this.ctx.close();
      this.ctx = null;
      this._setupAudioContext();
    }
    return this;
  }
  codecs(ext) {
    return this._codecs[ext.replace(/^x-/, "")] || false;
  }
  _setupAudioContext() {
    this.ctx = null;
    try {
      if (typeof AudioContext !== "undefined") {
        this.ctx = new AudioContext;
      } else if (typeof webkitAudioContext !== "undefined") {
        this.ctx = new webkitAudioContext;
      } else {
        this.usingWebAudio = false;
      }
    } catch (e) {
      this.usingWebAudio = false;
    }
    const iOS = /iP(hone|od|ad)/.test(this._navigator?.platform || "");
    const appVersion = this._navigator?.appVersion.match(/OS (\\d+)_(\\d+)_?(\\d+)?/);
    const version = appVersion ? Number.parseInt(appVersion[1], 10) : null;
    if (iOS && version && version < 9) {
      this.usingWebAudio = false;
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    if (this.usingWebAudio && this.ctx) {
      this.masterGain = typeof this.ctx.createGain === "undefined" ? createGain(this.ctx) : this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    this._setupCodecs();
    if (this.autoUnlock) {
      this._autoUnlock();
    }
    if (this.usingWebAudio && typeof document !== "undefined") {
      if (this.ctx && this._stateEvents.length > 0) {
        for (let i = 0;i < this._stateEvents.length; i++) {
          this.ctx.addEventListener(this._stateEvents[i], this._handleAudioStateChange.bind(this));
        }
      }
      this._handleAutoSuspend();
      document.addEventListener("visibilitychange", this._handleVisibilityChange.bind(this));
      document.addEventListener("pagehide", this._handlePageHide.bind(this));
      document.addEventListener("pageshow", this._handlePageShow.bind(this));
    }
    return this;
  }
  _setupCodecs() {
    const testFn = (element, codec) => {
      if (!element) {
        return false;
      }
      try {
        const result = element.canPlayType(codec);
        return canPlayResult(result);
      } catch (e) {
        return false;
      }
    };
    const audio = typeof Audio !== "undefined" ? new Audio : null;
    if (!audio || typeof audio.canPlayType !== "function") {
      this.noAudio = true;
      return this;
    }
    const mpegTest = audio.canPlayType("audio/mpeg;").replace(/^no$/, "");
    const checkOpera = this._navigator?.userAgent.match(/OPR\/([0-6].)/g);
    const isOldOpera = checkOpera && Number.parseInt(checkOpera[0].split("/")[1], 10) < 33;
    this._codecs = {
      mp3: !!(!isOldOpera && (mpegTest || testFn(audio, "audio/mp3;"))),
      mpeg: !!mpegTest,
      opus: !!testFn(audio, 'audio/ogg; codecs="opus"'),
      ogg: !!testFn(audio, 'audio/ogg; codecs="vorbis"'),
      oga: !!testFn(audio, 'audio/ogg; codecs="vorbis"'),
      wav: !!testFn(audio, 'audio/wav; codecs="1"'),
      aac: !!testFn(audio, "audio/aac;"),
      caf: !!testFn(audio, "audio/x-caf;"),
      m4a: !!(testFn(audio, "audio/x-m4a;") || testFn(audio, "audio/m4a;") || testFn(audio, "audio/aac;")),
      m4b: !!(testFn(audio, "audio/x-m4b;") || testFn(audio, "audio/m4b;") || testFn(audio, "audio/aac;")),
      mp4: !!(testFn(audio, "audio/x-mp4;") || testFn(audio, "audio/mp4;") || testFn(audio, "audio/aac;")),
      weba: !!testFn(audio, 'audio/webm; codecs="vorbis"'),
      webm: !!testFn(audio, 'audio/webm; codecs="vorbis"'),
      dolby: !!testFn(audio, 'audio/mp4; codecs="ec-3"'),
      flac: !!(testFn(audio, "audio/x-flac;") || testFn(audio, "audio/flac;"))
    };
    return this;
  }
  _autoUnlock() {
    if (!this.ctx || !this.autoUnlock || !this._navigator || !this._navigator.userAgent) {
      return this;
    }
    const isMobile = /iPhone|iPad|iPod|Android|BlackBerry|BB10|Silk|Mobi|Chrome|Safari/i.test(this._navigator.userAgent);
    if (!isMobile) {
      return this;
    }
    const isIOS = /iPhone|iPad|iPod/i.test(this._navigator.userAgent);
    const audioUnlocked = false;
    if (isIOS) {
      try {
        const myAudio = new Audio;
        myAudio.muted = true;
        const playPromise = myAudio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(() => {
            return this;
          }).catch(() => {});
        }
      } catch (e) {}
    }
    const unlock = () => {
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      if (this.ctx) {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        if (typeof source.start === "undefined") {
          source.noteOn(0);
        } else {
          source.start(0);
        }
      }
      if (this.ctx && typeof this.ctx.resume === "function") {
        this.ctx.resume();
      }
      if (this._unlockTimeout) {
        clearTimeout(this._unlockTimeout);
      }
      this._unlockTimeout = setTimeout(() => {
        for (let i = 0;i < this._howls.length; i++) {
          this._howls[i]._emitEvent("unlock");
        }
      }, 0);
    };
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("touchend", unlock, true);
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return this;
  }
  _handleAudioStateChange(e) {
    if (e.type === "suspended") {
      for (let i = 0;i < this._howls.length; i++) {
        this._howls[i]._handleSuspend();
      }
    } else if (e.type === "running" && this.ctx) {
      const now = this.ctx.currentTime;
      for (let i = 0;i < this._howls.length; i++) {
        this._howls[i]._emit("resume", null, now);
      }
    }
  }
  _handleAutoSuspend() {
    if (!this.autoSuspend || !this.ctx || typeof this.ctx.suspend === "undefined" || !this.usingWebAudio) {
      return this;
    }
    for (let i = 0;i < this._howls.length; i++) {
      if (this._howls[i]._webAudio) {
        for (let j = 0;j < this._howls[i]._sounds.length; j++) {
          if (!this._howls[i]._sounds[j]._paused) {
            return this;
          }
        }
      }
    }
    if (this._suspendTimer) {
      clearTimeout(this._suspendTimer);
    }
    this._suspendTimer = setTimeout(() => {
      if (!this.autoSuspend) {
        return;
      }
      this._suspendTimer = null;
      this.state = "suspending";
      this.ctx?.suspend().then(() => {
        this.state = "suspended";
        if (this._resumeAfterSuspend) {
          this._resumeAfterSuspend = undefined;
          this._autoResume();
        }
      });
    }, 30000);
    return this;
  }
  _autoResume() {
    if (!this.ctx || typeof this.ctx.resume === "undefined" || !this.usingWebAudio) {
      return this;
    }
    if (this.state === "running" && this._suspendTimer) {
      clearTimeout(this._suspendTimer);
      this._suspendTimer = null;
    } else if (this.state === "suspended" || this.state === "suspending" && this._resumeAfterSuspend) {
      this.ctx.resume().then(() => {
        this.state = "running";
        for (let i = 0;i < this._howls.length; i++) {
          this._howls[i]._emit("resume");
        }
      });
      if (this._suspendTimer) {
        clearTimeout(this._suspendTimer);
        this._suspendTimer = null;
      }
    } else if (this.state === "suspending") {
      this._resumeAfterSuspend = true;
    }
    return this;
  }
  _handleVisibilityChange() {
    if (document.hidden) {
      for (let i = 0;i < this._howls.length; i++) {
        this._howls[i]._onVisibilityChange(true);
      }
    } else {
      for (let i = 0;i < this._howls.length; i++) {
        this._howls[i]._onVisibilityChange(false);
      }
    }
  }
  _handlePageHide() {
    for (let i = 0;i < this._howls.length; i++) {
      this._howls[i]._onPageHide();
    }
  }
  _handlePageShow() {
    for (let i = 0;i < this._howls.length; i++) {
      this._howls[i]._onPageShow();
    }
  }
  _suspendTimer = null;
  _resumeAfterSuspend = false;
  state = "running";
}

class Howl {
  _src;
  _state;
  _sounds;
  _endTimers;
  _queue;
  _playLock;
  _onend;
  _onfade;
  _onload;
  _onloaderror;
  _onplayerror;
  _onpause;
  _onplay;
  _onstop;
  _onmute;
  _onvolume;
  _onrate;
  _onseek;
  _onunlock;
  _onresume;
  _preload;
  _html5;
  _muted;
  _volume;
  _rate;
  _loop;
  _sprite;
  _duration;
  _pos;
  _loaded;
  _webAudio;
  _autoplay;
  _xhr;
  _pool;
  _xhrWithCredentials;
  _formats;
  constructor(options) {
    this._autoplay = options.autoplay || false;
    this._format = typeof options.format !== "string" ? options.format : [options.format];
    this._html5 = options.html5 || false;
    this._muted = options.mute || false;
    this._loop = options.loop || false;
    this._pool = options.pool || 5;
    this._preload = options.preload === undefined ? true : options.preload;
    this._rate = options.rate || 1;
    this._sprite = options.sprite || {};
    this._src = typeof options.src !== "string" ? options.src : [options.src];
    this._volume = options.volume !== undefined ? options.volume : 1;
    this._xhr = null;
    this._xhrWithCredentials = options.xhrWithCredentials || false;
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
    this._onend.push(options.onend || (() => {}));
    this._onload.push(options.onload || (() => {}));
    this._onloaderror.push(options.onloaderror || (() => {}));
    this._onplayerror.push(options.onplayerror || (() => {}));
    this._onpause.push(options.onpause || (() => {}));
    this._onplay.push(options.onplay || (() => {}));
    this._onstop.push(options.onstop || (() => {}));
    this._onmute.push(options.onmute || (() => {}));
    this._onvolume.push(options.onvolume || (() => {}));
    this._onrate.push(options.onrate || (() => {}));
    this._onseek.push(options.onseek || (() => {}));
    this._onfade.push(options.onfade || (() => {}));
    this._onunlock.push(options.onunlock || (() => {}));
    this._state = "unloaded";
    this._sounds = [];
    this._endTimers = {};
    this._queue = [];
    this._playLock = false;
    this._duration = 0;
    this._formats = null;
    this._loaded = false;
    this._pos = 0;
    this._webAudio = Howler.usingWebAudio && !this._html5;
    if (this._html5) {
      this._webAudio = false;
    }
    Howler._howls.push(this);
    if (Howler.noAudio) {
      this._onloaderror[0](0, "No audio support");
      return;
    }
    if (this._preload) {
      this.load();
    }
  }
  load() {
    if (this._loaded || this._state === "loading") {
      return this;
    }
    this._state = "loading";
    if (this._html5) {
      this._loadHtml5();
    } else {
      this._loadBuffer();
    }
    return this;
  }
  _loadBuffer() {
    if (!this._formats) {
      this._formats = [];
      for (let i = 0;i < this._src.length; i++) {
        const ext = this._src[i].split(".").pop() || "";
        const format = ext.toLowerCase();
        if (this._formats.indexOf(format) === -1) {
          this._formats.push(format);
        }
      }
    }
    let source = null;
    for (let i = 0;i < this._formats.length; i++) {
      if (Howler.codecs(this._formats[i])) {
        for (let j = 0;j < this._src.length; j++) {
          if (this._src[j].split(".").pop()?.toLowerCase() === this._formats[i]) {
            source = this._src[j];
            break;
          }
        }
        if (source) {
          break;
        }
      }
    }
    if (!source) {
      this._emit("loaderror", null, "No codec support for selected audio sources.");
      return this;
    }
    this._src = source;
    this._xhr = new XMLHttpRequest;
    const xhr = this._xhr;
    xhr.open("GET", source, true);
    xhr.withCredentials = this._xhrWithCredentials;
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300 || xhr.status === 0) {
        this._loadFromArrayBuffer(xhr.response);
      } else {
        this._emit("loaderror", null, `Failed loading audio file: ${source}`);
      }
    };
    xhr.onerror = () => {
      this._emit("loaderror", null, `Failed loading audio file: ${source}`);
    };
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        this._emit("loadprogress", null, event.loaded / event.total);
      }
    };
    xhr.send();
    return this;
  }
  _loadFromArrayBuffer(arraybuffer) {
    if (!Howler.ctx) {
      return;
    }
    Howler.ctx.decodeAudioData(arraybuffer, (buffer) => {
      if (buffer && this._state === "loading") {
        this._duration = buffer.duration;
        this._setupAudioNode(buffer);
        this._state = "loaded";
        this._loaded = true;
        this._emit("load");
        this._loadQueue();
      }
    }, (err) => {
      this._emit("loaderror", null, err);
    });
  }
  _setupAudioNode(buffer) {
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
      _sprite: "__default",
      _loop: this._loop,
      _parent: this,
      _fading: null,
      _node: null
    };
    this._sounds.push(sound);
    if (this._autoplay) {
      this.play(sound.id);
    }
  }
  _loadHtml5() {
    let source = null;
    for (let i = 0;i < this._src.length; i++) {
      const ext = this._src[i].split(".").pop() || "";
      if (Howler.codecs(ext)) {
        source = this._src[i];
        break;
      }
    }
    if (!source) {
      this._emit("loaderror", null, "No codec support for selected audio sources.");
      return this;
    }
    this._src = source;
    const node = new Audio;
    node.autoplay = false;
    node.preload = this._preload === true ? "auto" : typeof this._preload === "string" ? this._preload : "auto";
    node.crossOrigin = "anonymous";
    const errorFn = () => {
      node.removeEventListener("error", errorFn);
      node.removeEventListener(Howler._canPlayEvent, loadFn);
      this._emit("loaderror", null, `Failed loading audio file: ${source}`);
    };
    const loadFn = () => {
      node.removeEventListener("error", errorFn);
      node.removeEventListener(Howler._canPlayEvent, loadFn);
      node.removeEventListener("loadedmetadata", loadFn);
      node.removeEventListener("suspend", setAudioNodeWasSuspendedFromEvent);
      this._setupSound(node);
    };
    node.addEventListener("error", errorFn);
    node.addEventListener(Howler._canPlayEvent, loadFn);
    node.addEventListener("loadedmetadata", loadFn);
    node._wasSuspended = false;
    node.addEventListener("suspend", setAudioNodeWasSuspendedFromEvent);
    node.src = source;
    node.load();
    return this;
  }
  _setupSound(node) {
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
      _sprite: "__default",
      _loop: this._loop,
      _parent: this,
      _fading: null
    };
    this._sounds.push(sound);
    if (node.duration > 0) {
      this._duration = node.duration;
    }
    this._state = "loaded";
    this._loaded = true;
    this._emit("load");
    this._loadQueue();
    if (this._autoplay) {
      this.play(sound.id);
    }
  }
  _loadQueue() {
    if (this._state !== "loaded") {
      return this;
    }
    for (let i = 0;i < this._queue.length; i++) {
      this._queue[i]();
    }
    this._queue = [];
    return this;
  }
  play(sprite, callback) {
    if (typeof sprite === "function") {
      callback = sprite;
      sprite = undefined;
    }
    if (typeof sprite === "undefined") {
      sprite = "__default";
    }
    if (this._state !== "loaded") {
      this._queue.push(() => {
        return this.play(sprite, callback);
      });
      return typeof sprite === "string" ? this._sounds[0]?.id || 0 : this._sounds[0]?.id || 0;
    }
    if (typeof sprite === "string" && !this._sprite[sprite]) {
      if (callback) {
        callback();
      }
      return 0;
    }
    if (typeof sprite === "number") {
      const sound = this._soundById(sprite);
      if (!sound) {
        return 0;
      }
      if (callback) {
        sound._onend = callback;
      }
      this._playSound(sound);
      return sound.id;
    }
    const ids = [];
    for (let i = 0;i < this._sounds.length; i++) {
      const sound = this._sounds[i];
      if (sound._paused && !sound._ended) {
        continue;
      }
      const spriteData = typeof sprite === "string" ? this._sprite[sprite] : null;
      if (spriteData) {
        sound._sprite = sprite;
        const start = spriteData[0] / 1000;
        const end = spriteData[1] / 1000;
        sound._duration = end - start;
        if (spriteData.length > 2) {
          sound._loop = !!spriteData[2];
        }
        sound._pos = start;
        sound._seek = 0;
      }
      if (callback) {
        sound._onend = callback;
      }
      ids.push(sound.id);
      this._playSound(sound);
    }
    return ids.length > 1 ? ids : ids[0];
  }
  _playSound(sound) {
    if (!sound._paused) {
      return;
    }
    if (sound._webAudio) {
      Howler._autoResume();
      sound._gainNode = Howler.ctx.createGain();
      sound._gainNode.gain.setValueAtTime(sound._muted ? 0 : sound._volume, Howler.ctx.currentTime);
      sound._gainNode.connect(Howler.masterGain);
      sound._node = Howler.ctx.createBufferSource();
      sound._node.buffer = sound._buffer;
      sound._node.playbackRate.setValueAtTime(sound._rate, Howler.ctx.currentTime);
      sound._node.connect(sound._gainNode);
      sound._node.onended = () => {
        this._ended(sound);
      };
      if (sound._loop) {
        sound._node.loop = true;
        sound._node.loopStart = sound._pos;
        sound._node.loopEnd = sound._pos + sound._duration;
      }
      sound._node.start(Howler.ctx.currentTime, sound._pos, sound._loop ? 999999999 : sound._duration);
      sound._playStart = Howler.ctx.currentTime;
      sound._paused = false;
      sound._ended = false;
      this._emit("play", sound.id);
    } else {
      Howler._autoResume();
      if (sound._node instanceof HTMLAudioElement) {
        if (!sound._node.paused || sound._node.currentTime !== sound._pos) {
          sound._node.currentTime = sound._pos;
        }
      }
      if (sound._node instanceof HTMLAudioElement) {
        sound._node.volume = sound._muted ? 0 : sound._volume;
      }
      if (sound._node instanceof HTMLAudioElement) {
        sound._node.playbackRate = sound._rate;
      }
      if (sound._node.networkState === 1 && sound._node._wasSuspended) {
        sound._node.play();
      } else {
        try {
          const promise = sound._node.play();
          if (promise && typeof promise.catch === "function") {
            promise.catch((err) => {
              if (sound.id === this._sounds[0].id) {
                this._emit("playerror", sound.id, err);
              }
            });
          }
        } catch (err) {
          this._emit("playerror", sound.id, err);
        }
      }
      sound._paused = false;
      sound._ended = false;
      this._emit("play", sound.id);
    }
  }
  pause(id) {
    if (typeof id === "undefined") {
      for (let i = 0;i < this._sounds.length; i++) {
        this.pause(this._sounds[i].id);
      }
      return this;
    }
    const sound = this._soundById(id);
    if (!sound || sound._paused) {
      return this;
    }
    sound._paused = true;
    sound._ended = false;
    if (sound._webAudio) {
      if (sound._node?.bufferSource) {
        sound._node.bufferSource.stop(Howler.ctx.currentTime);
      }
    } else {
      if (sound._node && !isPaused(sound._node)) {
        pauseNode(sound._node);
      }
    }
    this._clearTimer(id);
    this._emit("pause", id);
    return this;
  }
  stop(id) {
    if (typeof id === "undefined") {
      for (let i = 0;i < this._sounds.length; i++) {
        if (!this._sounds[i]._paused) {
          this.stop(this._sounds[i].id);
        }
      }
      return this;
    }
    const sound = this._soundById(id);
    if (!sound) {
      return this;
    }
    sound._paused = true;
    sound._ended = true;
    sound._seek = 0;
    sound._pos = 0;
    if (sound._webAudio) {
      if (sound._node?.bufferSource) {
        sound._node.bufferSource.stop(Howler.ctx.currentTime);
      }
    } else {
      if (sound._node instanceof HTMLAudioElement && !sound._node.paused) {
        sound._node.pause();
        sound._node.currentTime = 0;
      }
    }
    this._clearTimer(id);
    this._emit("stop", id);
    return this;
  }
  mute(muted, id) {
    if (typeof id === "undefined") {
      this._muted = muted;
      for (let i = 0;i < this._sounds.length; i++) {
        this._sounds[i]._muted = muted;
        if (this._sounds[i]._node) {
          if (this._webAudio) {
            if (this._sounds[i]._gainNode) {
              this._sounds[i]._gainNode.gain.setValueAtTime(muted ? 0 : this._sounds[i]._volume * Howler._volume, Howler.ctx.currentTime);
            }
          } else {
            this._sounds[i]._node.volume = muted ? 0 : this._sounds[i]._volume * Howler._volume;
          }
        }
      }
      this._emit("mute", muted);
      return this;
    }
    const sound = this._soundById(id);
    if (!sound) {
      return this;
    }
    sound._muted = muted;
    if (sound._node) {
      if (this._webAudio) {
        if (sound._gainNode) {
          sound._gainNode.gain.setValueAtTime(muted ? 0 : sound._volume * Howler._volume, Howler.ctx.currentTime);
        }
      } else {
        sound._node.volume = muted ? 0 : sound._volume * Howler._volume;
      }
    }
    this._emit("mute", id);
    return this;
  }
  volume(vol, id) {
    if (typeof vol === "number" && typeof id === "undefined") {
      this._volume = Math.max(0, Math.min(1, vol));
      for (let i = 0;i < this._sounds.length; i++) {
        if (!this._sounds[i]._muted) {
          if (this._webAudio) {
            if (this._sounds[i]._gainNode) {
              this._sounds[i]._gainNode.gain.setValueAtTime(vol * Howler._volume, Howler.ctx.currentTime);
            }
          } else {
            this._sounds[i]._node.volume = vol * Howler._volume;
          }
        }
      }
      return this;
    }
    if (typeof id === "undefined") {
      return this._volume;
    }
    const sound = this._soundById(id);
    if (!sound) {
      return this;
    }
    if (typeof vol !== "undefined") {
      sound._volume = Math.max(0, Math.min(1, vol));
      if (!sound._muted) {
        if (this._webAudio) {
          if (sound._gainNode) {
            sound._gainNode.gain.setValueAtTime(sound._volume * Howler._volume, Howler.ctx.currentTime);
          }
        } else {
          setVolume(sound._node, sound._volume * Howler._volume);
        }
      }
      this._emit("volume", id);
      return this;
    }
    return sound._volume;
  }
  rate(rate, id) {
    if (typeof rate === "number" && typeof id === "undefined") {
      this._rate = Math.max(0.5, Math.min(4, rate));
      for (let i = 0;i < this._sounds.length; i++) {
        this._sounds[i]._rate = rate;
        if (!this._sounds[i]._paused) {
          if (this._webAudio) {
            if (this._sounds[i]._node?.bufferSource) {
              this._sounds[i]._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
            }
          } else {
            if (this._sounds[i]._node instanceof HTMLAudioElement) {
              this._sounds[i]._node.playbackRate = rate;
            }
          }
        }
      }
      return this;
    }
    if (typeof id === "undefined") {
      return this._rate;
    }
    const sound = this._soundById(id);
    if (!sound) {
      return this;
    }
    if (typeof rate !== "undefined") {
      sound._rate = Math.max(0.5, Math.min(4, rate));
      if (!sound._paused) {
        if (this._webAudio) {
          if (sound._node?.bufferSource) {
            sound._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
          }
        } else {
          if (sound._node instanceof HTMLAudioElement) {
            setPlaybackRate(sound._node, rate, Howler.ctx);
          }
        }
      }
      this._emit("rate", id);
      return this;
    }
    return sound._rate;
  }
  seek(seek, id) {
    if (typeof id === "undefined") {
      if (this._sounds.length) {
        id = this._sounds[0].id;
      } else {
        return 0;
      }
    }
    const sound = this._soundById(id);
    if (!sound) {
      return 0;
    }
    if (this._state !== "loaded") {
      this._queue.push(() => {
        return this.seek(seek, id);
      });
      return this;
    }
    if (typeof seek !== "undefined" && !Number.isNaN(seek)) {
      seek = Math.max(0, Math.min(sound._duration, seek));
      sound._seek = seek;
      sound._pos = seek;
      if (sound._node) {
        if (this._webAudio) {
          if (!sound._paused) {
            this.pause(id).play(id);
          }
        } else if (sound._node instanceof HTMLAudioElement) {
          sound._node.currentTime = seek;
        }
      }
      this._emit("seek", id);
      return this;
    }
    if (sound._paused || sound._ended) {
      return sound._seek;
    }
    let pos = 0;
    if (this._webAudio) {
      pos = (Howler.ctx.currentTime - sound._playStart) * sound._rate;
      if (pos > sound._duration) {
        pos = sound._duration;
      }
    } else {
      pos = getCurrentTime(sound._node);
    }
    return pos;
  }
  playing(id) {
    if (typeof id === "undefined") {
      for (let i = 0;i < this._sounds.length; i++) {
        if (!this._sounds[i]._paused) {
          return true;
        }
      }
      return false;
    }
    const sound = this._soundById(id);
    return sound ? !sound._paused : false;
  }
  duration(id) {
    if (typeof id === "undefined") {
      return this._duration;
    }
    const sound = this._soundById(id);
    return sound ? sound._duration : 0;
  }
  state(id) {
    if (typeof id === "undefined") {
      return this._state;
    }
    const sound = this._soundById(id);
    if (!sound) {
      return "stopped";
    }
    if (sound._paused) {
      return "paused";
    }
    if (!sound._paused && !sound._ended) {
      return "playing";
    }
    return "stopped";
  }
  unload() {
    this.stop();
    if (this._webAudio) {
      for (let i = 0;i < this._sounds.length; i++) {
        const sound = this._sounds[i];
        this._cleanBuffer(sound);
        if (sound._node) {
          if (sound._node instanceof AudioBufferSourceNode) {
            safeDisconnect(sound._node);
          }
        }
        if (sound._gainNode) {
          sound._gainNode.disconnect(0);
        }
      }
    } else {
      for (let i = 0;i < this._sounds.length; i++) {
        const sound = this._sounds[i];
        if (sound._node) {
          sound._node.removeEventListener("error", sound._errorFn, false);
          sound._node.removeEventListener(Howler._canPlayEvent, sound._loadFn, false);
          sound._node.removeEventListener("loadedmetadata", sound._loadFn, false);
          sound._node.removeEventListener("suspend", setAudioNodeWasSuspendedFromEvent, false);
          sound._node.removeEventListener("ended", sound._endFn, false);
          sound._node = null;
        }
      }
      if (Howler._howls.indexOf(this) >= 0) {
        Howler._howls.splice(Howler._howls.indexOf(this), 1);
      }
    }
    this._endTimers = {};
    this._queue = [];
    this._onend = [];
    this._state = "unloaded";
    this._sounds = [];
    return this;
  }
  on(event, fn, id) {
    const events = this[`_on${event}`];
    if (typeof fn === "function") {
      events.push(id ? { id, fn } : { id: null, fn });
    }
    return this;
  }
  off(event, fn, id) {
    const events = this[`_on${event}`];
    if (fn) {
      for (let i = 0;i < events.length; i++) {
        if (events[i].fn === fn && (typeof id === "undefined" || events[i].id === id)) {
          events.splice(i, 1);
          break;
        }
      }
    } else if (event) {
      this[`_on${event}`] = [];
    } else {
      const keys = Object.keys(this);
      for (let i = 0;i < keys.length; i++) {
        if (keys[i].indexOf("_on") === 0 && Array.isArray(this[keys[i]])) {
          this[keys[i]] = [];
        }
      }
    }
    return this;
  }
  _emit(event, soundId, message) {
    if (!this[`_on${event}`]) {
      return this;
    }
    for (let i = this[`_on${event}`].length - 1;i >= 0; i--) {
      const listener = this[`_on${event}`][i];
      if (!listener.id || listener.id === soundId) {
        setTimeout(() => {
          listener.fn.call(this, soundId, message);
        }, 0);
      }
    }
    return this;
  }
  _emitEvent(event, message) {
    if (!this[`_on${event}`]) {
      return this;
    }
    for (let i = this[`_on${event}`].length - 1;i >= 0; i--) {
      const listener = this[`_on${event}`][i];
      setTimeout(() => {
        listener.fn.call(this, null, message);
      }, 0);
    }
    return this;
  }
  _clearTimer(id) {
    if (this._endTimers[id]) {
      clearTimeout(this._endTimers[id]);
      delete this._endTimers[id];
    }
    return this;
  }
  _ended(sound) {
    if (!sound._webAudio) {
      sound._node.removeEventListener("ended", sound._endFn, false);
      if (sound._node instanceof HTMLAudioElement) {
        sound._node.currentTime = 0;
        sound._node.pause();
      }
      if (sound._node.duration === Number.POSITIVE_INFINITY) {
        sound._node.duration = 0;
      }
    }
    sound._paused = true;
    sound._ended = true;
    sound._seek = 0;
    this._emit("end", sound.id);
    this._clearTimer(sound.id);
    if (this._loop && !sound._loop) {
      this.play(sound.id);
    }
  }
  _inactiveSound() {
    for (let i = 0;i < this._sounds.length; i++) {
      if (this._sounds[i]._ended || !this._sounds[i]._loaded) {
        return this._sounds[i];
      }
    }
    if (this._webAudio && this._sounds.length < this._pool) {
      return this._createSound();
    }
    return null;
  }
  _createSound() {
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
      _sprite: "__default",
      _loop: this._loop,
      _parent: this,
      _fading: null,
      _node: null
    };
    this._sounds.push(sound);
    return sound;
  }
  _soundById(id) {
    for (let i = 0;i < this._sounds.length; i++) {
      if (id === this._sounds[i].id) {
        return this._sounds[i];
      }
    }
    return null;
  }
  _getSoundIds() {
    const ids = [];
    for (let i = 0;i < this._sounds.length; i++) {
      ids.push(this._sounds[i].id);
    }
    return ids;
  }
  _cleanBuffer(sound) {
    if (Howler.ctx && sound._node && sound._node.bufferSource) {
      sound._node.bufferSource.disconnect(0);
      try {
        sound._node.bufferSource = undefined;
      } catch (err) {
        sound._node.bufferSource = null;
      }
    }
    return this;
  }
  _handleSuspend() {
    for (let i = 0;i < this._sounds.length; i++) {
      const sound = this._sounds[i];
      if (!sound._paused && !sound._ended) {
        sound._suspendStart = Howler.ctx?.currentTime || 0;
        this._cleanBuffer(sound);
      }
    }
  }
  _handleResume(time) {
    for (let i = 0;i < this._sounds.length; i++) {
      const sound = this._sounds[i];
      if (sound._suspendStart) {
        sound._pos += sound._suspendStart - time;
        sound._suspendStart = undefined;
        this.pause(sound.id).play(sound.id);
      }
    }
  }
  _onVisibilityChange(hidden) {
    if (hidden) {
      for (let i = 0;i < this._sounds.length; i++) {
        if (!this._sounds[i]._paused) {
          this._sounds[i]._visibilityPause = true;
          this.pause(this._sounds[i].id);
        }
      }
    } else {
      for (let i = 0;i < this._sounds.length; i++) {
        if (this._sounds[i]._visibilityPause) {
          this._sounds[i]._visibilityPause = undefined;
          this.play(this._sounds[i].id);
        }
      }
    }
  }
  _onPageHide() {
    for (let i = 0;i < this._sounds.length; i++) {
      if (!this._sounds[i]._paused) {
        this._sounds[i]._pageHide = true;
        this.pause(this._sounds[i].id);
      }
    }
  }
  _onPageShow() {
    for (let i = 0;i < this._sounds.length; i++) {
      if (this._sounds[i]._pageHide) {
        this._sounds[i]._pageHide = undefined;
        this.play(this._sounds[i].id);
      }
    }
  }
  _format = null;
}
var Howler = new HowlerGlobal;
var setAudioNodeWasSuspendedFromEvent = (event) => {
  if (event.target) {
    event.target._wasSuspended = true;
  }
};
if (typeof window !== "undefined") {
  window.HowlerGlobal = HowlerGlobal;
  window.Howler = Howler;
}
// tests/js/core.html5audio.ts
var HTML5Audio = function() {
  this.sound = null;
};
HTML5Audio.prototype.run = function() {
  const self = this;
  self.sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  console.info("Using HTML5 Audio");
  self.testsFinished = 0;
  self.testPlay();
  self.testPlayWithoutURL();
  self.testPlaySprite();
  self.testMultiPlay();
  self.testVolume();
  self.testFade();
  self.testMute();
  self.testRate();
  self.testLoop();
  self.testSeek();
  self.testPlayOnSeek();
  self.testStop();
  self.testOnload();
  self.testOnError();
  self.testAutoSuspend();
  self.testMultipleHowls();
};
HTML5Audio.prototype.testPlay = function() {
  const self = this;
  const id = self.sound.play();
  self.sound.once("end", () => {
    console.log("Play: PASSED");
    self.testsFinished++;
  }, id);
};
HTML5Audio.prototype.testPlayWithoutURL = function() {
  const sound = new Howl({
    src: "../audio/invalid-url.mp3",
    html5: true
  });
  sound.once("loaderror", () => {
    console.log("PlayWithoutURL: PASSED");
  });
};
HTML5Audio.prototype.testPlaySprite = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    sprite: {
      test: [0, 1000]
    }
  });
  const id = sound.play("test");
  sound.once("end", () => {
    console.log("PlaySprite: PASSED");
    self.testsFinished++;
  }, id);
};
HTML5Audio.prototype.testMultiPlay = function() {
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  sound.play();
  sound.play();
  console.log("MultiPlay: PASSED");
};
HTML5Audio.prototype.testVolume = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    volume: 0.5
  });
  if (sound.volume() === 0.5) {
    console.log("Volume: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testFade = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound2.webm", "../audio/sound2.mp3"],
    html5: true
  });
  const id = sound.play();
  sound.volume(0, id);
  sound.fade(0, 1, 1000, id);
  sound.once("end", () => {
    console.log("Fade: PASSED");
    self.testsFinished++;
  }, id);
};
HTML5Audio.prototype.testMute = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    volume: 0.5
  });
  const id = sound.play();
  sound.mute(true, id);
  if (sound.volume(id) === 0.5 && sound.mute() === true) {
    console.log("Mute: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testRate = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    rate: 2
  });
  const id = sound.play();
  if (sound.rate() === 2) {
    console.log("Rate: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testLoop = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    loop: true
  });
  const id = sound.play();
  sound.loop(false, id);
  if (sound.loop(id) === false) {
    console.log("Loop: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testSeek = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  const id = sound.play();
  sound.seek(1.5, id);
  setTimeout(() => {
    if (Math.round(sound.seek(id)) === 2) {
      console.log("Seek: PASSED");
      self.testsFinished++;
    }
  }, 1000);
};
HTML5Audio.prototype.testPlayOnSeek = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  const id = sound.seek(1.5);
  if (sound.seek(id) >= 1.5 && sound.playing(id) === false) {
    console.log("PlayOnSeek: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testStop = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  const id = sound.play();
  sound.stop(id);
  setTimeout(() => {
    if (sound.playing(id) === false) {
      console.log("Stop: PASSED");
      self.testsFinished++;
    }
  }, 100);
};
HTML5Audio.prototype.testOnload = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true,
    onload: () => {
      console.log("OnLoad: PASSED");
      self.testsFinished++;
    }
  });
};
HTML5Audio.prototype.testOnError = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/invalid.mp3"],
    html5: true,
    onloaderror: () => {
      console.log("OnError: PASSED");
      self.testsFinished++;
    }
  });
};
HTML5Audio.prototype.testAutoSuspend = function() {
  const self = this;
  const sound = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  if (Howler.autoSuspend) {
    console.log("AutoSuspend: PASSED");
    self.testsFinished++;
  }
};
HTML5Audio.prototype.testMultipleHowls = function() {
  const self = this;
  const sound1 = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  const sound2 = new Howl({
    src: ["../audio/sound1.webm", "../audio/sound1.mp3"],
    html5: true
  });
  sound1.play();
  sound2.play();
  console.log("MultipleHowls: PASSED");
  self.testsFinished++;
};
var core_html5audio_default = new HTML5Audio;
export {
  core_html5audio_default as default
};
