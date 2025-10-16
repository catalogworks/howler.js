import { Howl } from '../../src/index';
// Setup Web Audio tests
const WebAudio = function () {
    this.sound = null;
};
// Run all Web Audio tests
WebAudio.prototype.run = function () {
    const self = this;
    // Create a new Howl with Web Audio.
    self.sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3']
    });
    // Report Web Audio is used
    console.info('Using Web Audio');
    // Run the tests.
    self.testsFinished = 0;
    self.testPlay();
    self.testPlayMultiple();
    self.testStop();
    self.testSoundId();
    self.testVolume();
    self.testFade();
    self.testHtmlCache();
    self.testCachePlay();
};
WebAudio.prototype.testPlay = function () {
    const self = this;
    // Play the sound.
    const id = self.sound.play();
    // Register callback for the end of playback.
    self.sound.once('end', function () {
        console.log('Play: PASSED');
        self.testsFinished++;
    }, id);
};
WebAudio.prototype.testPlayMultiple = function () {
    const self = this;
    // Play two sounds.
    const id1 = self.sound.play();
    const id2 = self.sound.play();
    // Make sure they are both playing.
    if (self.sound.playing(id1) && self.sound.playing(id2)) {
        console.log('PlayMultiple: PASSED');
        self.testsFinished++;
    }
};
WebAudio.prototype.testStop = function () {
    const self = this;
    // Play a sound.
    const id = self.sound.play();
    // Stop it after 500ms and make sure it is stopped.
    setTimeout(function () {
        self.sound.stop(id);
        if (!self.sound.playing(id)) {
            console.log('Stop: PASSED');
            self.testsFinished++;
        }
    }, 500);
};
WebAudio.prototype.testSoundId = function () {
    const self = this;
    // Play a sound and get the ID.
    const id = self.sound.play();
    // Make sure the sound exists in the cache.
    if (id && self.sound._sounds && self.sound._sounds[0]) {
        console.log('SoundId: PASSED');
        self.testsFinished++;
    }
};
WebAudio.prototype.testVolume = function () {
    const self = this;
    // Play a sound and get the ID.
    const id = self.sound.play();
    // Set a new volume.
    self.sound.volume(0.5, id);
    // Check to make sure the volume was properly set.
    setTimeout(function () {
        if (self.sound.volume(id) === 0.5) {
            console.log('Volume: PASSED');
            self.testsFinished++;
        }
    }, 500);
};
WebAudio.prototype.testFade = function () {
    const self = this;
    // Play a sound and fade from 0 to 1.
    const id = self.sound.play();
    self.sound.volume(0, id);
    self.sound.fade(0, 1, 1000, id);
    // Check to make sure the volume was properly faded.
    setTimeout(function () {
        const vol = self.sound.volume(id);
        if (vol > 0.7 && vol < 1) {
            console.log('Fade: PASSED');
            self.testsFinished++;
        }
    }, 750);
};
WebAudio.prototype.testHtmlCache = function () {
    const self = this;
    // Create a new Howl with HTML5 forced.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Play a sound.
    sound.play();
    // Check if this sound is using HTML5 Audio.
    const html5 = !!(sound._sounds[0]._node.paused !== undefined);
    if (html5) {
        console.log('HtmlCache: PASSED');
        self.testsFinished++;
    }
};
WebAudio.prototype.testCachePlay = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound2.webm', '../audio/sound2.mp3'],
        onplayerror: function () {
            console.log('CachePlay: FAILED');
        },
        onload: function () {
            console.log('CachePlay: PASSED');
            self.testsFinished++;
        }
    });
    // Try to play a sound after the cache has loaded.
    sound.once('load', function () {
        sound.play();
    });
};
export default new WebAudio();
//# sourceMappingURL=core.webaudio.js.map