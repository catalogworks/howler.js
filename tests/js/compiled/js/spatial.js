import { Howl, Howler } from '../../src/index';
// Setup Spatial Audio tests
const SpatialAudio = function () {
    this.sound = null;
};
// Run all Spatial Audio tests
SpatialAudio.prototype.run = function () {
    const self = this;
    // Create a new Howl with Spatial Audio support.
    self.sound = new Howl({
        src: ['../audio/sound1.webm', '../audio/sound1.mp3']
    });
    // Report Spatial Audio is used
    console.info('Using Spatial Audio Plugin');
    // Run the tests.
    self.testsFinished = 0;
    self.testGlobalStereo();
    self.testGlobalPosition();
    self.testGlobalOrientation();
    self.testGlobalVelocity();
    self.testSoundStereo();
    self.testSoundPosition();
};
SpatialAudio.prototype.testGlobalStereo = function () {
    const self = this;
    // Set global stereo panning.
    Howler.stereo(-1);
    // Check if stereo is set.
    if (Math.round(Howler.stereo()) === -1) {
        console.log('GlobalStereo: PASSED');
        self.testsFinished++;
    }
    // Reset stereo panning.
    Howler.stereo(0);
};
SpatialAudio.prototype.testGlobalPosition = function () {
    const self = this;
    // Set global position.
    Howler.pos(1, 2, 3);
    // Check if position is set.
    const pos = Howler.pos();
    if (pos[0] === 1 && pos[1] === 2 && pos[2] === 3) {
        console.log('GlobalPosition: PASSED');
        self.testsFinished++;
    }
    // Reset position.
    Howler.pos(0, 0, 0);
};
SpatialAudio.prototype.testGlobalOrientation = function () {
    const self = this;
    // Set global orientation.
    Howler.orientation(1, 2, 3, 4, 5, 6);
    // Check if orientation is set.
    const orient = Howler.orientation();
    if (orient[0] === 1 &&
        orient[1] === 2 &&
        orient[2] === 3 &&
        orient[3] === 4 &&
        orient[4] === 5 &&
        orient[5] === 6) {
        console.log('GlobalOrientation: PASSED');
        self.testsFinished++;
    }
    // Reset orientation.
    Howler.orientation(0, 0, -1, 0, 1, 0);
};
SpatialAudio.prototype.testGlobalVelocity = function () {
    const self = this;
    // Set global velocity.
    Howler.velocity(1, 2, 3);
    // Check if velocity is set.
    const vel = Howler.velocity();
    if (vel[0] === 1 && vel[1] === 2 && vel[2] === 3) {
        console.log('GlobalVelocity: PASSED');
        self.testsFinished++;
    }
    // Reset velocity.
    Howler.velocity(0, 0, 0);
};
SpatialAudio.prototype.testSoundStereo = function () {
    const self = this;
    // Set sound stereo.
    const id = self.sound.play();
    self.sound.stereo(-0.5, id);
    // Make sure stereo is set.
    if (self.sound.stereo(id) === -0.5) {
        console.log('SoundStereo: PASSED');
        self.testsFinished++;
    }
    // Stop the sound.
    self.sound.stop(id);
};
SpatialAudio.prototype.testSoundPosition = function () {
    const self = this;
    // Set sound position.
    const id = self.sound.play();
    self.sound.pos(3, 4, 5, id);
    // Make sure position is set.
    const pos = self.sound.pos(id);
    if (pos[0] === 3 && pos[1] === 4 && pos[2] === 5) {
        console.log('SoundPosition: PASSED');
        self.testsFinished++;
    }
    // Stop the sound.
    self.sound.stop(id);
};
export default new SpatialAudio();
