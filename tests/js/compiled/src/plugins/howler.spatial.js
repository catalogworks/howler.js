/**
 * @file Spatial Plugin - Adds support for stereo and 3D audio where Web Audio is supported.
 * @version 3.0.0
 * @author @catalogworks
 * @copyright Copyright (c) 2013-2025 @catalogworks
 * @license MIT License
 */
import { Howl, Howler, HowlerGlobal } from '../howler.core';
// Setup default spatial properties
const HowlerGlobalProto = HowlerGlobal.prototype;
HowlerGlobalProto._pos = [0, 0, 0];
HowlerGlobalProto._orientation = [0, 0, -1, 0, 1, 0];
HowlerGlobalProto._velocity = [0, 0, 0];
HowlerGlobalProto._listenerAttr = {};
/**
 * Helper method to update the stereo panning position of all current Howls.
 * Future Howls will not use this value unless explicitly set.
 * @param pan A value of -1.0 is all the way left and 1.0 is all the way right.
 * @return Self or current stereo panning value.
 */
HowlerGlobalProto.stereo = function (pan) {
    // Stop right here if not using Web Audio
    if (!this.ctx || !this.ctx.listener) {
        return this;
    }
    // Loop through all Howls and update their stereo panning
    for (let i = this._howls.length - 1; i >= 0; i--) {
        this._howls[i].stereo(pan);
    }
    return this;
};
/**
 * Get/set the position of the listener in 3D cartesian space. Sounds using
 * 3D position will be relative to the listener's position.
 * @param x The x-position of the listener.
 * @param y The y-position of the listener.
 * @param z The z-position of the listener.
 * @return Self or current listener position.
 */
HowlerGlobalProto.pos = function (x, y, z) {
    // Stop right here if not using Web Audio
    if (!this.ctx || !this.ctx.listener) {
        return this;
    }
    // Set the defaults for optional 'y' & 'z'
    y = typeof y !== 'number' ? this._pos[1] : y;
    z = typeof z !== 'number' ? this._pos[2] : z;
    // Update the listener's position
    if (typeof x === 'number') {
        this._pos = [x, y, z];
        if (typeof this.ctx.listener.positionX !== 'undefined') {
            this.ctx.listener.positionX.setValueAtTime(this._pos[0], Howler.ctx.currentTime);
            this.ctx.listener.positionY.setValueAtTime(this._pos[1], Howler.ctx.currentTime);
            this.ctx.listener.positionZ.setValueAtTime(this._pos[2], Howler.ctx.currentTime);
        }
        else {
            this.ctx.listener.setPosition(this._pos[0], this._pos[1], this._pos[2]);
        }
    }
    return this._pos;
};
/**
 * Get/set the direction the listener is pointing in the 3D cartesian space.
 * A front and up vector must be provided. The front is the direction the
 * face of the listener is pointing, and up is the direction the top of the
 * listener is pointing. Thus, these values are expected to be at right angles
 * from each other.
 * @param x x-orientation of listener's front.
 * @param y y-orientation of listener's front.
 * @param z z-orientation of listener's front.
 * @param xUp x-orientation of listener's top.
 * @param yUp y-orientation of listener's top.
 * @param zUp z-orientation of listener's top.
 * @return Self or current listener orientation.
 */
HowlerGlobalProto.orientation = function (x, y, z, xUp, yUp, zUp) {
    // Stop right here if not using Web Audio
    if (!this.ctx || !this.ctx.listener) {
        return this;
    }
    // Set the defaults for optional y & z
    const currentOrientation = this._orientation;
    y = typeof y !== 'number' ? currentOrientation[1] : y;
    z = typeof z !== 'number' ? currentOrientation[2] : z;
    // Set the defaults for optional xUp, yUp & zUp
    xUp = typeof xUp !== 'number' ? currentOrientation[3] : xUp;
    yUp = typeof yUp !== 'number' ? currentOrientation[4] : yUp;
    zUp = typeof zUp !== 'number' ? currentOrientation[5] : zUp;
    // Update the listener's orientation
    if (typeof x === 'number') {
        this._orientation = [x, y, z, xUp, yUp, zUp];
        if (typeof this.ctx.listener.forwardX !== 'undefined') {
            this.ctx.listener.forwardX.setValueAtTime(x, Howler.ctx.currentTime);
            this.ctx.listener.forwardY.setValueAtTime(y, Howler.ctx.currentTime);
            this.ctx.listener.forwardZ.setValueAtTime(z, Howler.ctx.currentTime);
            this.ctx.listener.upX.setValueAtTime(xUp, Howler.ctx.currentTime);
            this.ctx.listener.upY.setValueAtTime(yUp, Howler.ctx.currentTime);
            this.ctx.listener.upZ.setValueAtTime(zUp, Howler.ctx.currentTime);
        }
        else {
            this.ctx.listener.setOrientation(x, y, z, xUp, yUp, zUp);
        }
    }
    return this._orientation;
};
/**
 * Get/set the velocity vector of the listener.
 * @param x The x-velocity of the listener.
 * @param y The y-velocity of the listener.
 * @param z The z-velocity of the listener.
 * @return Self or current listener velocity.
 */
HowlerGlobalProto.velocity = function (x, y, z) {
    // Stop right here if not using Web Audio
    const ctx = this.ctx;
    if (!ctx || !ctx.listener) {
        return this;
    }
    // Set the defaults for optional 'y' & 'z'
    y = typeof y !== 'number' ? this._velocity[1] : y;
    z = typeof z !== 'number' ? this._velocity[2] : z;
    // Update the listener's velocity
    if (typeof x === 'number') {
        this._velocity = [x, y, z];
        if (typeof ctx.listener.positionX !== 'undefined') {
            ctx.listener.velocityX.setValueAtTime(x, Howler.ctx.currentTime);
            ctx.listener.velocityY.setValueAtTime(y, Howler.ctx.currentTime);
            ctx.listener.velocityZ.setValueAtTime(z, Howler.ctx.currentTime);
        }
        else {
            ctx.listener.setVelocity(x, y, z);
        }
    }
    return this._velocity;
};
/**
 * Add new properties to the core init.
 * @param options Web Audio API listener parameters
 */
HowlerGlobalProto.listenerId = function (options) {
    const ctx = this.ctx;
    if (!ctx || !ctx.listener) {
        return this;
    }
    // Check for listener attributes to update
    options = options || {};
    for (const key in options) {
        if (Object.hasOwn(this._listenerAttr, key)) {
            this._listenerAttr[key] = options[key];
            if (key === 'dopplerFactor' || key === 'speedOfSound') {
                ctx.listener[key] = options[key];
            }
        }
    }
    return this;
};
/**
 * Add support for 3D audio and stereo panning to Howls.
 * @param options Panner attributes
 * @return Self
 */
const HowlProto = Howl.prototype;
HowlProto.stereo = function (pan, id) {
    // If the sound hasn't loaded, add it to the load queue
    if (this._state !== 'loaded') {
        this._queue.push({
            event: 'stereo',
            action: () => {
                this.stereo(pan, id);
            }
        });
        return this;
    }
    // Check for ID
    const ids = this._getSoundIds(id);
    // If we don't have an ID, get all IDs
    if (typeof pan === 'undefined') {
        // Return the spatial position of the first sound
        return this._soundById(ids[0])._stereo;
    }
    // If we're using Web Audio, use the spatial plugin
    if (this._webAudio) {
        // Loop through all IDs
        for (let i = 0; i < ids.length; i++) {
            // Get the sound
            const sound = this._soundById(ids[i]);
            if (sound) {
                if (typeof pan === 'number') {
                    sound._stereo = pan;
                    sound._pos = [pan, 0, 0];
                    if (sound._node) {
                        // If we're falling back, make sure the panning works
                        sound._panner = this.ctx.createStereoPanner();
                        sound._panner.pan.setValueAtTime(pan, Howler.ctx.currentTime);
                        sound._panner.connect(sound._gainNode);
                        if (sound.bufferSource) {
                            sound.bufferSource.disconnect();
                            sound.bufferSource.connect(sound._panner);
                        }
                    }
                    this._emit('stereo', sound._id);
                }
            }
        }
    }
    return this;
};
/**
 * Get/set the 3D spatial position of the sound in relation to the global listener.
 * @param x The x-position of the sound.
 * @param y The y-position of the sound.
 * @param z The z-position of the sound.
 * @param id The sound ID.
 * @return Self or current position.
 */
HowlProto.pos = function (x, y, z, id) {
    // If the sound hasn't loaded, add it to the load queue
    if (this._state !== 'loaded') {
        this._queue.push({
            event: 'pos',
            action: () => {
                this.pos(x, y, z, id);
            }
        });
        return this;
    }
    // Set the defaults for optional 'y' & 'z'
    y = typeof y !== 'number' ? 0 : y;
    z = typeof z !== 'number' ? -0.5 : z;
    // Check for ID
    const ids = this._getSoundIds(id);
    // If we don't have an ID, get all IDs
    if (typeof x === 'undefined') {
        // Return the spatial position of the first sound
        const sound = this._soundById(ids[0]);
        return sound ? sound._pos : [0, 0, 0];
    }
    // If we're using Web Audio, use the spatial plugin
    if (this._webAudio) {
        // Loop through all IDs
        for (let i = 0; i < ids.length; i++) {
            // Get the sound
            const sound = this._soundById(ids[i]);
            if (sound) {
                if (typeof x === 'number') {
                    sound._pos = [x, y, z];
                    if (sound._node) {
                        // Create a new panner if we don't have one
                        if (!sound._panner || sound._panner.pan) {
                            setupPanner(sound);
                        }
                        // Update the panner
                        sound._panner.setPosition(x, y, z);
                    }
                    this._emit('pos', sound._id);
                }
            }
        }
    }
    return this;
};
/**
 * Get/set the direction the sound is pointing in the 3D cartesian coordinate space.
 * @param x The x-orientation of the sound.
 * @param y The y-orientation of the sound.
 * @param z The z-orientation of the sound.
 * @param id The sound ID.
 * @return Self or current direction.
 */
HowlProto.orientation = function (x, y, z, id) {
    // If the sound hasn't loaded, add it to the load queue
    if (this._state !== 'loaded') {
        this._queue.push({
            event: 'orientation',
            action: () => {
                this.orientation(x, y, z, id);
            }
        });
        return this;
    }
    // Set the defaults for optional 'y' & 'z'
    y = typeof y !== 'number' ? 0 : y;
    z = typeof z !== 'number' ? -1 : z;
    // Check for ID
    const ids = this._getSoundIds(id);
    // If we don't have an ID, get all IDs
    if (typeof x === 'undefined') {
        // Return the spatial position of the first sound
        const sound = this._soundById(ids[0]);
        return sound ? sound._orientation : [0, 0, -1];
    }
    // If we're using Web Audio, use the spatial plugin
    if (this._webAudio) {
        // Loop through all IDs
        for (let i = 0; i < ids.length; i++) {
            // Get the sound
            const sound = this._soundById(ids[i]);
            if (sound) {
                if (typeof x === 'number') {
                    sound._orientation = [x, y, z];
                    if (sound._node) {
                        // Create a new panner if we don't have one
                        if (!sound._panner || sound._panner.pan) {
                            setupPanner(sound);
                        }
                        // Update the panner
                        if (typeof sound._panner.orientationX !== 'undefined') {
                            sound._panner.orientationX.setValueAtTime(x, Howler.ctx.currentTime);
                            sound._panner.orientationY.setValueAtTime(y, Howler.ctx.currentTime);
                            sound._panner.orientationZ.setValueAtTime(z, Howler.ctx.currentTime);
                        }
                        else {
                            sound._panner.setOrientation(x, y, z);
                        }
                    }
                    this._emit('orientation', sound._id);
                }
            }
        }
    }
    return this;
};
/**
 * Get/set the velocity vector of the sound.
 * @param x The x-velocity of the sound.
 * @param y The y-velocity of the sound.
 * @param z The z-velocity of the sound.
 * @param id The sound ID.
 * @return Self or current velocity.
 */
HowlProto.velocity = function (x, y, z, id) {
    // If the sound hasn't loaded, add it to the load queue
    if (this._state !== 'loaded') {
        this._queue.push({
            event: 'velocity',
            action: () => {
                this.velocity(x, y, z, id);
            }
        });
        return this;
    }
    // Set the defaults for optional 'y' & 'z'
    y = typeof y !== 'number' ? 0 : y;
    z = typeof z !== 'number' ? 0 : z;
    // Check for ID
    const ids = this._getSoundIds(id);
    // If we don't have an ID, get all IDs
    if (typeof x === 'undefined') {
        // Return the velocity of the first sound
        const sound = this._soundById(ids[0]);
        return sound ? sound._velocity : [0, 0, 0];
    }
    // If we're using Web Audio, use the spatial plugin
    if (this._webAudio) {
        // Loop through all IDs
        for (let i = 0; i < ids.length; i++) {
            // Get the sound
            const sound = this._soundById(ids[i]);
            if (sound) {
                if (typeof x === 'number') {
                    sound._velocity = [x, y, z];
                    if (sound._node) {
                        // Create a new panner if we don't have one
                        if (!sound._panner || sound._panner.pan) {
                            setupPanner(sound);
                        }
                        // Update the panner
                        if (typeof sound._panner.velocityX !== 'undefined') {
                            sound._panner.velocityX.setValueAtTime(x, Howler.ctx.currentTime);
                            sound._panner.velocityY.setValueAtTime(y, Howler.ctx.currentTime);
                            sound._panner.velocityZ.setValueAtTime(z, Howler.ctx.currentTime);
                        }
                        else {
                            sound._panner.setVelocity(x, y, z);
                        }
                    }
                    this._emit('velocity', sound._id);
                }
            }
        }
    }
    return this;
};
/**
 * Get/set the panner node's attributes for a sound or group of sounds.
 * @param options Panner options.
 * @param id The sound ID.
 * @return Self or current panner attributes.
 */
HowlProto.pannerAttr = function (options, id) {
    // If the sound hasn't loaded, add it to the load queue
    if (this._state !== 'loaded') {
        this._queue.push({
            event: 'pannerAttr',
            action: () => {
                this.pannerAttr(options, id);
            }
        });
        return this;
    }
    // Check for ID
    const ids = this._getSoundIds(id);
    // If we don't have an ID, get all IDs
    if (typeof options === 'undefined') {
        // Return the first sound's panner attributes
        const sound = this._soundById(ids[0]);
        return sound ? sound._pannerAttr : null;
    }
    // If we're using Web Audio, use the spatial plugin
    if (this._webAudio) {
        // Loop through all IDs
        for (let i = 0; i < ids.length; i++) {
            // Get the sound
            const sound = this._soundById(ids[i]);
            if (sound) {
                // Update the panner attributes
                sound._pannerAttr = options;
                if (sound._panner) {
                    // Update the spatial plugin's panner attributes
                    if (options.coneInnerAngle !== undefined) {
                        sound._panner.coneInnerAngle = options.coneInnerAngle;
                    }
                    if (options.coneOuterAngle !== undefined) {
                        sound._panner.coneOuterAngle = options.coneOuterAngle;
                    }
                    if (options.coneOuterGain !== undefined) {
                        sound._panner.coneOuterGain = options.coneOuterGain;
                    }
                    if (options.distanceModel !== undefined) {
                        sound._panner.distanceModel = options.distanceModel;
                    }
                    if (options.maxDistance !== undefined) {
                        sound._panner.maxDistance = options.maxDistance;
                    }
                    if (options.refDistance !== undefined) {
                        sound._panner.refDistance = options.refDistance;
                    }
                    if (options.rolloffFactor !== undefined) {
                        sound._panner.rolloffFactor = options.rolloffFactor;
                    }
                    if (options.panningModel !== undefined) {
                        sound._panner.panningModel = options.panningModel;
                    }
                }
                else {
                    // Create a new panner
                    setupPanner(sound);
                }
            }
        }
    }
    return this;
};
/**
 * Helper method to set up a panner node
 * @param sound Sound object
 */
const setupPanner = (sound) => {
    // Create a new panner node
    sound._panner = Howler.ctx.createPanner();
    sound._panner.coneInnerAngle = sound._pannerAttr?.coneInnerAngle || 360;
    sound._panner.coneOuterAngle = sound._pannerAttr?.coneOuterAngle || 360;
    sound._panner.coneOuterGain = sound._pannerAttr?.coneOuterGain || 0;
    sound._panner.distanceModel = sound._pannerAttr?.distanceModel || 'inverse';
    sound._panner.maxDistance = sound._pannerAttr?.maxDistance || 10000;
    sound._panner.refDistance = sound._pannerAttr?.refDistance || 1;
    sound._panner.rolloffFactor = sound._pannerAttr?.rolloffFactor || 1;
    sound._panner.panningModel = sound._pannerAttr?.panningModel || 'HRTF';
    // Set the position, orientation, and velocity
    sound._panner.setPosition(sound._pos[0], sound._pos[1], sound._pos[2]);
    if (sound._orientation) {
        sound._panner.setOrientation(sound._orientation[0], sound._orientation[1], sound._orientation[2]);
    }
    else {
        sound._panner.setOrientation(0, 0, -1);
    }
    if (sound._velocity) {
        sound._panner.setVelocity(sound._velocity[0], sound._velocity[1], sound._velocity[2]);
    }
    else {
        sound._panner.setVelocity(0, 0, 0);
    }
    // Connect the panner
    sound._panner.connect(sound._gainNode);
    if (sound.bufferSource) {
        sound.bufferSource.disconnect();
        sound.bufferSource.connect(sound._panner);
    }
};
// Override the '_loadQueue' method to add spatialization
const originalLoadQueue = HowlProto._loadQueue;
HowlProto._loadQueue = function () {
    // Process the original queue
    originalLoadQueue.call(this);
    if (this._state === 'loaded') {
        // Process the spatial queue
        if (this._spatial && this._webAudio) {
            for (let i = 0; i < this._queue.length; i++) {
                const item = this._queue[i];
                if (item.event === 'pannerAttr') {
                    this.pannerAttr(item.options, item.id);
                }
                else if (item.event === 'pos') {
                    this.pos(item.x, item.y, item.z, item.id);
                }
                else if (item.event === 'orientation') {
                    this.orientation(item.x, item.y, item.z, item.id);
                }
                else if (item.event === 'velocity') {
                    this.velocity(item.x, item.y, item.z, item.id);
                }
                else if (item.event === 'stereo') {
                    this.stereo(item.pan, item.id);
                }
            }
        }
        // Clear the queue
        this._queue = [];
    }
    return this;
};
// Add support to get/set the buffer source
HowlProto._setup = function (soundId, options = {}) {
    // Create a spatial panner
    if (this._webAudio && options.spatial) {
        options.pannerAttr = options.pannerAttr || {};
        this.pannerAttr(options.pannerAttr, soundId);
    }
};
/**
 * Get a sound ID by index
 * @param id Sound ID
 * @return Array of sound IDs or a single sound ID
 */
HowlProto._getSoundIds = function (id) {
    if (typeof id === 'undefined') {
        const ids = [];
        for (let i = 0; i < this._sounds.length; i++) {
            ids.push(this._sounds[i].id);
        }
        return ids;
    }
    return [id];
};
//# sourceMappingURL=howler.spatial.js.map