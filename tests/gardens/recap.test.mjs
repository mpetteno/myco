import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { bed, areaV2, plan, planV5, snapshot } from '../planting/fixtures.mjs';

const { getGardenRecap } = await loadModule('src/features/garden/summarizeGarden.ts','garden-recap');
after(cleanupModules);
const first = areaV2({lengthCm:100,rowCount:2});
const second = areaV2({id:'area-b',yCm:100,lengthCm:100,rowCount:2});

test('garden recap groups the same type across beds and areas, and includes unplanted beds in the footprint',()=>{
  const beds=[{...bed,plantingPlan:planV5({areas:[first,second]})},
    {...bed,id:'bed-b',xCm:150,plantingPlan:planV5({areas:[first,{...second,plant:{...snapshot,id:'type-b',name:'Type B'}}]})},
    {...bed,id:'empty',xCm:300,widthCm:50,lengthCm:100}];
  const before=structuredClone(beds),recap=getGardenRecap(beds);
  assert.equal(recap.occupiedAreaCm2,45000);
  assert.equal(recap.totalPlants,24);
  assert.deepEqual(recap.plants,[{id:'type-a',name:'Type A',plants:18},{id:'type-b',name:'Type B',plants:6}]);
  assert.deepEqual(recap.invalidBeds,[]);assert.deepEqual(beds,before);
});

test('recap retains saved historical spacing and explicit overrides instead of upgrading the plan format',()=>{
  const old={...bed,plantingPlan:plan()};
  assert.equal(getGardenRecap([old]).totalPlants,21);
  const custom={...bed,plantingPlan:planV5({respectAreaSpacing:false,areas:[areaV2({rowCount:3,plantSpacingCm:10})]})};
  assert.equal(getGardenRecap([custom]).totalPlants,54);
});

test('empty and invalid plans have explicit recap states without losing the bed footprint',()=>{
  assert.deepEqual(getGardenRecap([]),{occupiedAreaCm2:0,totalPlants:0,invalidBeds:[],sowings:[],plants:[]});
  const result=getGardenRecap([{...bed,plantingPlan:planV5({areas:[areaV2({plantSpacingCm:0})]})}]);
  assert.equal(result.occupiedAreaCm2,20000);assert.deepEqual(result.invalidBeds,[bed.name]);
});
