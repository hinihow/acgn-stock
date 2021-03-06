import { Meteor } from 'meteor/meteor';

import { countdownManager } from '/server/imports/utils/countdownManager';
import { dbCompanies } from '/db/dbCompanies';
import { dbDirectors } from '/db/dbDirectors';
import { debug } from '/server/imports/utils/debug';

function generateCheckChairmanCounter() {
  return Meteor.settings.public.checkChairmanCounter;
}

export function countDownCheckChairman() {
  debug.log('countDownCheckChairman');

  const counterKey = 'checkChairmanCounter';

  if (! countdownManager.isInitialized(counterKey)) {
    countdownManager.set(counterKey, generateCheckChairmanCounter());
  }

  countdownManager.countDown(counterKey);

  if (! countdownManager.isZeroReached(counterKey)) {
    return;
  }

  const nextCounter = generateCheckChairmanCounter();
  countdownManager.set(counterKey, nextCounter);

  checkChairman();
}

// 對全市場進行董事長檢查
export function checkChairman() {
  debug.log('checkChairman');

  const companiesBulk = dbCompanies.rawCollection().initializeUnorderedBulkOp();
  let needExecuteBulk = false;

  dbCompanies.find({
    isSeal: false
  }, {
    fields: {
      _id: 1,
      chairman: 1
    }
  })
    .forEach((companyData) => {
      const companyId = companyData._id;
      const chairmanData = dbDirectors.findOne({
        companyId: companyId,
        userId: { $ne: '!FSC' }
      }, {
        sort: {
          stocks: -1,
          createdAt: 1
        },
        fields: { userId: 1 }
      });
      const newChairman = chairmanData ? chairmanData.userId : '!none';

      if (newChairman !== companyData.chairman) {
        needExecuteBulk = true;
        companiesBulk
          .find({ _id: companyId })
          .updateOne({ $set: { chairman: newChairman } });
      }
    });

  if (needExecuteBulk) {
    Meteor.wrapAsync(companiesBulk.execute).call(companiesBulk);
  }
}
