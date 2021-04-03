import DiscardHistory from '../../lib/models/discard-history';
import Repository from '../../lib/models/repository';
import path from 'path';
import fs from 'fs-extra';
import {
  cloneRepository, setUpLocalAndRemoteRepositories, getHeadCommitOnRemote,
  assertDeepPropertyVals, assertEqualSortedArraysByKey, FAKE_USER, wireUpObserver, expectEvents,
} from '../helpers';
import { formatWithOptions } from 'util';

describe('DiscardHistory', () => {
  describe('restoreLastDiscardInTempFiles', () => {
    let repository;

    it('Should undo discard of files with same name', async function() {
      // Setup
      const workdir = await cloneRepository('three-files');
      repository = new Repository(workdir);
      await repository.getLoadPromise();
      // Create 2 files with same name
      fs.mkdirSync(path.join(workdir, 'sub1'));
      fs.mkdirSync(path.join(workdir, 'sub2'));
      const file1 = path.join(workdir, 'sub1', 'a.txt')
      const file2 = path.join(workdir, 'sub2', 'a.txt');
      fs.writeFileSync(file1, 'foo1\n', {encoding: 'utf8'});
      fs.writeFileSync(file2, 'foo2\n', {encoding: 'utf8'});

      console.log('New file created');
      await repository.updateDiscardHistory();
      const isSafe = function() { return true; };
      const unstagedChanges = await repository.getUnstagedChanges();
      const files = ['sub2/a.txt', 'sub1/a.txt'];
      await repository.storeBeforeAndAfterBlobs(files, isSafe, () => {
        files.pop();
        files.pop();
      });

      // Discard changes and restore last discard
      await repository.discardWorkDirChangesForPaths(unstagedChanges.map(c => c.filePath));
      const results = await repository.restoreLastDiscardInTempFiles(isSafe, null);

      // Check results
      results.map((merge_result, i) => {
        const {filePath, resultPath, conflict} = merge_result;
        if(path.dirname(filePath).endsWith('1'))
          assert.equal(fs.readFileSync(resultPath, 'utf8'), 'foo1\n');
        else
          assert.equal(fs.readFileSync(resultPath, 'utf8'), 'foo2\n');
      });
    });

  });

  describe('expandBlobsToFilesInTempFolder', () => {

    it('Should produce unique resultPaths', async () => {
      const history = new DiscardHistory(null, () => {
        return null;
      }, null, null);
      // simulate snapshots
      const snapshots = [
        {filePath: 'subfolder1/file', beforeSha: 'beforeSha', afterSha: 'afterSha'},
        {filePath: 'subfolder2/file', beforeSha: 'beforeSha', afterSha: 'afterSha'},
      ];

      // Perform test
      const results = await history.expandBlobsToFilesInTempFolder(snapshots);

      // Check results
      assert.isFalse(results[0].resultPath === results[1].resultPath);
    });

  });
});
