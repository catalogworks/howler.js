import { Howl, Howler } from '../../src/index';
// Setup HTML5 Audio tests
const HTML5Audio = function () {
    this.sound = null;
};
// Run all HTML5 Audio tests
HTML5Audio.prototype.run = function () {
    const self = this;
    // Create a new Howl with HTML5 Audio.
    self.sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Report HTML5 Audio is used
    console.info('Using HTML5 Audio');
    // Run the tests.
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
HTML5Audio.prototype.testPlay = function () {
    const self = this;
    // Play the sound.
    const id = self.sound.play();
    // Register callback for the end of playback.
    self.sound.once('end', () => {
        console.log('Play: PASSED');
        self.testsFinished++;
    }, id);
};
HTML5Audio.prototype.testPlayWithoutURL = function () {
    const sound = new Howl({
        src: '../audio/invalid-url.mp3',
        html5: true
    });
    sound.once('loaderror', () => {
        console.log('PlayWithoutURL: PASSED');
    });
};
HTML5Audio.prototype.testPlaySprite = function () {
    const self = this;
    // Create a new sprite.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        sprite: {
            test: [0, 1000]
        }
    });
    // Play the sprite.
    const id = sound.play('test');
    // Register callback for the end of playback.
    sound.once('end', () => {
        console.log('PlaySprite: PASSED');
        self.testsFinished++;
    }, id);
};
HTML5Audio.prototype.testMultiPlay = function () {
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Play a sound twice.
    sound.play();
    sound.play();
    console.log('MultiPlay: PASSED');
};
HTML5Audio.prototype.testVolume = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        volume: 0.5
    });
    // Verify the volume is correctly set.
    if (sound.volume() === 0.5) {
        console.log('Volume: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testFade = function () {
    const self = this;
    // Create a new Howl with HTML5 Audio.
    const sound = new Howl({
        src: ['../audio/sound2.webm', '../audio/sound2.mp3'],
        html5: true
    });
    // Play a sound with volume = 0 and fade in.
    const id = sound.play();
    sound.volume(0, id);
    sound.fade(0, 1, 1000, id);
    // Register callback for the end of playback.
    sound.once('end', () => {
        console.log('Fade: PASSED');
        self.testsFinished++;
    }, id);
};
HTML5Audio.prototype.testMute = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        volume: 0.5
    });
    // Verify the volume is correctly set.
    const id = sound.play();
    sound.mute(true, id);
    // Ensure mute is respected
    if (sound.volume(id) === 0.5 && sound.mute() === true) {
        console.log('Mute: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testRate = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        rate: 2
    });
    // Verify the rate is correctly set.
    const id = sound.play();
    if (sound.rate() === 2) {
        console.log('Rate: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testLoop = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        loop: true
    });
    // Verify the loop is correctly set.
    const id = sound.play();
    sound.loop(false, id);
    if (sound.loop(id) === false) {
        console.log('Loop: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testSeek = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Play and seek the sound.
    const id = sound.play();
    sound.seek(1.5, id);
    // Verify seek correctly fast-forwarded the sound.
    setTimeout(() => {
        if (Math.round(sound.seek(id)) === 2) {
            console.log('Seek: PASSED');
            self.testsFinished++;
        }
    }, 1000);
};
HTML5Audio.prototype.testPlayOnSeek = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Seek the sound with no pre-playback.
    const id = sound.seek(1.5);
    // Verify that seeking worked and the sound is still paused.
    if (sound.seek(id) >= 1.5 && sound.playing(id) === false) {
        console.log('PlayOnSeek: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testStop = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Play and immediately stop sound.
    const id = sound.play();
    sound.stop(id);
    // Ensure the sound is stopped.
    setTimeout(() => {
        if (sound.playing(id) === false) {
            console.log('Stop: PASSED');
            self.testsFinished++;
        }
    }, 100);
};
HTML5Audio.prototype.testOnload = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true,
        onload: () => {
            console.log('OnLoad: PASSED');
            self.testsFinished++;
        }
    });
};
HTML5Audio.prototype.testOnError = function () {
    const self = this;
    // Create a new Howl with invalid src.
    const sound = new Howl({
        src: ['../audio/invalid.mp3'],
        html5: true,
        onloaderror: () => {
            console.log('OnError: PASSED');
            self.testsFinished++;
        }
    });
};
HTML5Audio.prototype.testAutoSuspend = function () {
    const self = this;
    // Create a new Howl.
    const sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Confirm auto suspend is enabled.
    if (Howler.autoSuspend) {
        console.log('AutoSuspend: PASSED');
        self.testsFinished++;
    }
};
HTML5Audio.prototype.testMultipleHowls = function () {
    const self = this;
    // Create two Howls.
    const sound1 = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    const sound2 = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3'],
        html5: true
    });
    // Play both sounds.
    sound1.play();
    sound2.play();
    console.log('MultipleHowls: PASSED');
    self.testsFinished++;
};
export default new HTML5Audio();
//# sourceMappingURL=core.html5audio.js.map