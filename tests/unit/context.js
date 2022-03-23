var assert = require('assert');
const ZitiContext = require('@openziti/ziti-browzer-core').ZitiContext;



(function() {

    describe('runtime', function() {

        it('should succeed', () => {
          assert.ok(true);
        });


        it('should instantiate a ZitiContext', function() {
          var _zitiContext = new ZitiContext({
          });
      
          assert.notEqual(_zitiContext, undefined);
        });


    
    });

})();
