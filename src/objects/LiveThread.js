'use strict';
const EventEmitter = require('events').EventEmitter;
const WebSocket = require('ws');
const helpers = require('../helpers');
const api_type = 'json';

/**
* A class representing a live reddit thread
* @example
*
* // Get a livethread with the given ID
* r.get_livethread('whrdxo8dg9n0')
* @desc For the most part, reddit distributes the content of live threads via websocket, rather than through the REST API.
As such, snoowrap assigns each fetched LiveThread object a `stream` property, which takes the form of an
[EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter). To listen for new thread updates, simply
add listeners to that emitter.

The following events can be emitted:
- `update`: Occurs when a new update has been posted in this thread. Emits a `LiveUpdate` object containing information
about the new update.
- `activity`: Occurs periodically when the viewer count for this thread changes.
- `settings`: Occurs when the thread's settings change. Emits an object containing the new settings.
- `delete`: Occurs when an update has been deleted. Emits the ID of the deleted update.
- `strike`: Occurs when an update has been striken (marked incorrect and crossed out). Emits the ID of the striken update.
- `embeds_ready`: Occurs when embedded media is now available for a previously-posted update.
- `complete`: Occurs when this LiveThread has been marked as complete, and no more updates will be sent.

(Note: These event types are mapped directly from reddit's categorization of the updates. The descriptions above are
paraphrased from reddit's descriptions [here](https://www.reddit.com/dev/api#section_live).)

As a simple example, the following code would log all new livethread updates to the console:

```javascript
some_livethread.stream.on('update', data => {
  console.log(data.body);
});
```

* @extends RedditContent
*/
const LiveThread = class extends require('./RedditContent') {
  get _uri () {
    return `live/${this.id}/about`;
  }
  _transform_api_response (response_object) {
    const populated_stream = new EventEmitter();
    const raw_stream = new WebSocket(response_object.websocket_url);
    raw_stream.on('message', data => {
      const parsed = helpers._populate(JSON.parse(data), this._r);
      populated_stream.emit(parsed.type, parsed.payload);
    });
    return {...response_object, _websocket: raw_stream, stream: populated_stream};
  }
  /**
  * @summary Adds a new update to this thread.
  * @param {string} body The body of the new update
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  add_update (body) {
    return this._post({
      uri: `api/live/${this.id}/update`,
      form: {api_type, body}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Accepts a pending contributor invitation on this LiveThread.
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  accept_contributor_invite () {
    return this._post({uri: `api/live/${this.id}/accept_contributor_invite`, form: {api_type}}).return(this);
  }
  /**
  * @summary Permanently closes this thread, preventing any more updates from being added.
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  close_thread () {
    return this._post({uri: `api/live/${this.id}/close_thread`, form: {api_type}}).return(this);
  }
  /**
  * @summary Deletes an update from this LiveThread.
  * @param {object} $0
  * @param {string} $0.id The ID of the LiveUpdate that should be deleted
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  delete_update ({id}) {
    return this._post({
      uri: `api/live/${this.id}/delete_update`,
      form: {api_type, id: `${id.startsWith('LiveUpdate_') ? '' : 'LiveUpdate_'}${id}`}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Edits the settings on this LiveThread.
  * @param {object} $0
  * @param {string} $0.title The title of the thread
  * @param {string} [$0.description] A descriptions of the thread. 120 characters max
  * @param {string} [$0.resources] Information and useful links related to the thread. 120 characters max
  * @param {boolean} $0.nsfw Determines whether the thread is Not Safe For Work
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  edit_settings ({title, description, resources, nsfw}) {
    return this._post({
      uri: `api/live/${this.id}/edit`,
      form: {api_type, description, nsfw, resources, title}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Invites a contributor to this LiveThread.
  * @param {object} $0
  * @param {string} $0.name The name of the user who should be invited
  * @param {Array} $0.permissions The permissions that the invited user should receive. This should be an Array containing
  some combination of `'update', 'edit', 'manage'`. To invite a contributor with full permissions, omit this property.
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  invite_contributor ({name, permissions}) {
    return this._post({
      uri: `api/live/${this.id}/invite_contributor`,
      form: {
        api_type,
        name,
        permissions: helpers._format_livethread_permissions(permissions),
        type: 'liveupdate_contributor_invite'
      }
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Abdicates contributor status on this LiveThread.
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  leave_contributor () {
    return this._post({uri: `api/live/${this.id}/leave_contributor`, form: {api_type}}).return(this);
  }
  /**
  * @summary Reports this LiveThread for breaking reddit's rules.
  * @param {object} $0
  * @param {string} $0.reason The reason for the report. One of `spam`, `vote-manipulation`, `personal-information`,
  `sexualizing-minors`, `site-breaking`
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  report ({reason}) {
    return this._post({
      uri: `api/live/${this.id}/report`,
      form: {api_type, type: reason}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Removes the given user from contributor status on this LiveThread.
  * @param {object} $0
  * @param {string} $0.name The username of the account who should be removed
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  remove_contributor ({name}) {
    return this._r.get_user(name).id.then(user_id => this._post({
      uri: `api/live/${this.id}/rm_contributor`,
      form: {api_type, id: `t2_${user_id}`}
    })).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Revokes an invitation for the given user to become a contributor on this LiveThread.
  * @param {object} $0
  * @param {string} $0.name The username of the account whose invitation should be revoked
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  revoke_contributor_invite ({name}) {
    return this._r.get_user(name).id.then(user_id => this._post({
      uri: `api/live/${this.id}/rm_contributor_invite`,
      form: {api_type, id: `t2_${user_id}`}
    })).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Sets the permissions of the given contributor.
  * @param {object} $0
  * @param {string} $0.name The name of the user whose permissions should be changed
  * @param {Array} $0.permissions The updated permissions that the user should have. This should be an Array containing
  some combination of `'update', 'edit', 'manage'`. To give the contributor with full permissions, omit this property.
  * @returns {Promise} A Promise that fulfills with this LiveThread when the request is complete
  */
  set_contributor_permissions ({name, permissions}) {
    return this._post({
      uri: `api/live/${this.id}/set_contributor_permissions`,
      form: {api_type, name, permissions: helpers._format_livethread_permissions(permissions), type: 'liveupdate_contributor'}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Strikes (marks incorrect and crosses out) the given update.
  * @param {object} $0
  * @param {string} $0.id The ID of the update that should be striked.
  */
  strike_update ({id}) {
    return this._post({
      uri: `api/live/${this.id}/strike_update`,
      form: {api_type, id: `${id.startsWith('LiveUpdate_') ? '' : 'LiveUpdate_'}${id}`}
    }).then(helpers._handle_json_errors(this));
  }
  /**
  * @summary Gets a Listing containing past updates to this LiveThread.
  * @param {object} [options] Options for the resulting Listing
  * @returns {Promise} A Listing containing LiveUpdates
  */
  get_recent_updates (options) {
    return this._get_listing({uri: `live/${this.id}`, qs: options});
  }
  /**
  * @summary Gets a list of this LiveThread's contributors
  * @returns {Promise} An Array containing RedditUsers
  */
  get_contributors () {
    return this._get({uri: `live/${this.id}/contributors`});
  }
  /**
  * @summary Gets a list of reddit submissions linking to this LiveThread.
  * @param {object} [options] Options for the resulting Listing
  * @returns {Promise} A Listing containing Submissions
  */
  get_discussions (options) {
    return this._get_listing({uri: `live/${this.id}/discussions`, qs: options});
  }
  /**
  * @summary Stops listening for new updates on this LiveThread.
  * @desc To avoid memory leaks that can result from open sockets, it's recommended that you call this method when you're
  finished listening for updates on this LiveThread.
  * @returns {undefined}
  */
  close_stream () {
    this._websocket.close();
  }
};

module.exports = LiveThread;
