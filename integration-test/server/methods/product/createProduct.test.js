import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import expect from 'must';
import mustSinon from 'must-sinon';

import { dbCompanies } from '/db/dbCompanies';
import { dbProducts } from '/db/dbProducts';
import { pttUserFactory, companyFactory, productFactory } from '/dev-utils/factories';
import { createProduct } from '/server/methods/product/createProduct';

mustSinon(expect);

describe('method createProduct', function() {
  const productionFund = 10000;
  const productPriceLimit = 100;

  let userId;
  let companyId;

  beforeEach(function() {
    resetDatabase();

    userId = Accounts.createUser(pttUserFactory.build());
    companyId = dbCompanies.insert(companyFactory.build({
      manager: userId,
      productionFund,
      productPriceLimit
    }));
  });

  it('should create a new product and decrease the prodution fund of the company', function() {
    const inputProductData = productFactory.build({ companyId });

    createProduct(userId, inputProductData);

    const productData = dbProducts.findOne();
    productData.state.must.be.equal('planning');

    const companyData = dbCompanies.findOne(companyId);
    companyData.productionFund.must.be.equal(productionFund - productData.price * productData.totalAmount);
  });

  it('should fail if the price is over the product price limit', function() {
    const inputProductData = productFactory.build({ companyId, price: productPriceLimit + 1 });
    createProduct.bind(null, userId, inputProductData).must.throw(Meteor.Error, '產品售價過高！ [403]');
  });

  it('should fail if the user is not the manager of the company', function() {
    dbCompanies.update(companyId, { $set: { manager: 'someOtherUser' } });
    const inputProductData = productFactory.build({ companyId });
    createProduct.bind(null, userId, inputProductData).must.throw(Meteor.Error, '使用者並非該公司的經理人！ [401]');
  });

  it('should fail if the total cost is over the production fund', function() {
    const inputProductData = productFactory.build({ companyId, price: 1, totalAmount: productionFund + 1 });
    createProduct.bind(null, userId, inputProductData).must.throw(Meteor.Error, '剩餘生產資金不足！ [403]');
  });

  context('when the company has no manager', function() {
    beforeEach(function() {
      dbCompanies.update(companyId, { $set: { manager: '!none' } });
    });

    it('should success if the user is admin', function() {
      Meteor.users.update(userId, { $set: { 'profile.isAdmin': true } });
      const inputProductData = productFactory.build({ companyId });
      createProduct.bind(null, userId, inputProductData).must.not.throw();
    });

    it('should fail if the user is not admin', function() {
      Meteor.users.update(userId, { $set: { 'profile.isAdmin': false } });
      const inputProductData = productFactory.build({ companyId });
      createProduct.bind(null, userId, inputProductData).must.throw(Meteor.Error, '使用者並非金融管理會委員，無法進行此操作！ [401]');
    });
  });
});
