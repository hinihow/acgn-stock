import { check, Match } from 'meteor/check';
import { Meteor } from 'meteor/meteor';

import { dbArenaLog } from '/db/dbArenaLog';
import { limitSubscription } from '/server/imports/utils/rateLimit';
import { debug } from '/server/imports/utils/debug';
import { publishTotalCount } from '/server/imports/utils/publishTotalCount';

Meteor.publish('arenaLog', function(arenaId, companyId, offset) {
  debug.log('publish arenaLog', {arenaId, companyId, offset});
  check(companyId, String);
  check(offset, Match.Integer);

  const filter = { arenaId };
  if (companyId) {
    filter.companyId = companyId;
  }

  publishTotalCount('totalCountOfArenaLog', dbArenaLog.find(filter), this);

  const pageObserver = dbArenaLog
    .find(filter, {
      sort: {
        sequence: 1
      },
      skip: offset,
      limit: 30,
      disableOplog: true
    })
    .observeChanges({
      added: (id, fields) => {
        this.added('arenaLog', id, fields);
      },
      changed: (id, fields) => {
        this.changed('arenaLog', id, fields);
      },
      removed: (id) => {
        this.removed('arenaLog', id);
      }
    });

  this.ready();
  this.onStop(() => {
    pageObserver.stop();
  });
});
//一分鐘最多20次
limitSubscription('arenaLog');