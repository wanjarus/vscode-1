import * as assert from 'assert';
import * as vscode from 'vscode';
import { beforeEach, afterEach } from 'mocha';
import Connection = require('mongodb-connection-model/lib/model');
import * as sinon from 'sinon';
import {
  DefaultSavingLocations,
  StorageScope
} from '../../../storage/storageController';
import { TEST_DATABASE_URI } from '../dbTestHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=500&serverSelectionTimeoutMS=500';

suite('Explorer Controller Test Suite', function () {
  this.timeout(5000);

  beforeEach(async () => {
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
  });

  afterEach(async () => {
    // Unset the variable we set in `beforeEach`.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    // Reset our connections.
    await mdbTestExtension.testExtensionController._connectionController.disconnect();
    mdbTestExtension.testExtensionController._connectionController.clearAllConnections();
    sinon.restore();
  });

  test('should have a connections root', async () => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    assert(!!treeController, 'Tree controller should not be undefined');

    try {
      const treeControllerChildren = await treeController.getChildren();

      assert(
        treeControllerChildren.length === 1,
        `Tree controller should have 1 child, found ${treeControllerChildren.length}`
      );
      assert(
        treeControllerChildren[0].label === 'Connections',
        'Tree controller should have a "Connections" child'
      );
    } catch (error) {
      assert(false);
    }
  });

  test('it updates the connections to account for a change in the connection controller', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();
    const mockConnectionId = 'testConnectionId';

    try {
      testConnectionController._connections = {
        testConnectionId: {
          id: 'testConnectionId',
          connectionModel: new Connection(),
          name: 'testConnectionName',
          driverUrl: 'url',
          storageLocation: StorageScope.NONE
        }
      };
      testConnectionController.setConnnectingConnectionId(mockConnectionId);
      testConnectionController.setConnnecting(true);

      const treeControllerChildren = await treeController.getChildren();

      assert(
        treeControllerChildren.length === 1,
        `Tree controller should have 1 child, found ${treeControllerChildren.length}`
      );
      assert(
        treeControllerChildren[0].label === 'Connections',
        'Tree controller should have a "Connections" child'
      );

      const connectionsItems = await treeControllerChildren[0].getChildren();

      assert(
        connectionsItems.length === 1,
        `Expected there to be 1 connection tree item, found ${connectionsItems.length}`
      );
      assert(
        connectionsItems[0].label === 'testConnectionName',
        'There should be a connection tree item with the label "testConnectionName"'
      );

      testExplorerController.deactivate();
    } catch (error) {
      assert(false);
    }
  });

  test('when a connection is added and connected it is added to the tree and expanded', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    try {
      const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      assert(
        succesfullyConnected === true,
        'Expected a successful connection response.'
      );
      assert(
        Object.keys(testConnectionController._connections).length === 1,
        'Expected there to be 1 connection in the connection list.'
      );

      const activeId = testConnectionController.getActiveConnectionId();

      assert(
        activeId === Object.keys(testConnectionController._connections)[0],
        `Expected active connection to be '${
          Object.keys(testConnectionController._connections)[0]
        }' found ${activeId}`
      );

      const treeControllerChildren = await treeController.getChildren();
      const connectionsItems = await treeControllerChildren[0].getChildren();

      assert(
        connectionsItems.length === 1,
        `Expected there be 1 connection tree item, found ${connectionsItems.length}`
      );
      assert(
        connectionsItems[0].label === 'localhost:27018',
        'There should be a connection tree item with the label "localhost:27018"'
      );
      assert(
        connectionsItems[0].description === 'connected',
        'There should be a connection tree item with the description "connected"'
      );
      assert(
        connectionsItems[0].isExpanded,
        'Expected the connection tree item to be expanded'
      );
    } catch (error) {
      assert(false);
    }
  });

  test('only the active connection is displayed as connected in the tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    try {
      const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      assert(
        succesfullyConnected === true,
        'Expected a successful connection response.'
      );
      assert(
        Object.keys(testConnectionController._connections).length === 1,
        'Expected there to be 1 connection in the connection list.'
      );

      const connectionId =
        testConnectionController.getActiveConnectionId() || '';
      const connectionName =
        testConnectionController._connections[connectionId].name;

      assert(
        connectionName === 'localhost:27018',
        `Expected active connection name to be 'localhost:27018' found ${connectionName}`
      );
    } catch (error) {
      assert(false);
    }

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );
    } catch (error) {
      /* Silent fail (should fail) */
    }

    try {
      const treeControllerChildren = await treeController.getChildren();
      const connectionsItems = await treeControllerChildren[0].getChildren();

      assert(
        connectionsItems.length === 2,
        `Expected there be 2 connection tree item, found ${connectionsItems.length}`
      );
      assert(
        connectionsItems[0].label === 'localhost:27018',
        `First connection tree item should have label "localhost:27018" found ${connectionsItems[0].label}`
      );
      assert(
        connectionsItems[0].isExpanded === false,
        'Expected the first connection tree item to not be expanded'
      );
      assert(
        connectionsItems[1].label === 'shouldfail:27017',
        'Second connection tree item should have label "shouldfail:27017"'
      );

      testExplorerController.deactivate();
    } catch (error) {
      assert(false);
    }
  });

  test('shows the databases of connected connection in tree', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      const treeControllerChildren = await treeController.getChildren();
      const connectionsItems = await treeControllerChildren[0].getChildren();

      // Expand the connection.
      treeControllerChildren[0].onDidExpand();

      const databaseItems = await connectionsItems[0].getChildren();

      assert(
        databaseItems.length >= 3,
        `Expected there be 3 or more database tree items, found ${databaseItems.length}`
      );
      assert(
        databaseItems[0].label === 'admin',
        `First database tree item should have label "admin" found ${connectionsItems[0].label}.`
      );

      testExplorerController.deactivate();
    } catch (error) {
      assert(false);
    }
  });

  test('caches the expanded state of databases in the tree when a connection is expanded or collapsed', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;
    const treeController = testExplorerController.getTreeController();

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      const rootTreeItem = await treeController.getChildren();
      const connectionsTreeItem = rootTreeItem[0];
      const connectionsItems = await connectionsTreeItem.getChildren();

      // Expand the connection.
      const testConnectionTreeItem = connectionsItems[0];

      await testConnectionTreeItem.onDidExpand();

      const databaseItems = await testConnectionTreeItem.getChildren();

      assert(
        databaseItems[1].isExpanded === false,
        'Expected database tree item not to be expanded on default.'
      );

      // Expand the first database item.
      await databaseItems[1].onDidExpand();

      assert(
        databaseItems[1].isExpanded === true,
        'Expected database tree item be expanded.'
      );

      // Collapse the connection.
      testConnectionTreeItem.onDidCollapse();

      const databaseTreeItems = await testConnectionTreeItem.getChildren();

      assert(
        databaseTreeItems.length === 0,
        `Expected the connection tree to return no children when collapsed, found ${databaseTreeItems.length}`
      );

      testConnectionTreeItem.onDidExpand();

      const newDatabaseItems = await testConnectionTreeItem.getChildren();

      assert(
        newDatabaseItems[1].isExpanded === true,
        'Expected database tree to be expanded from cache.'
      );

      testExplorerController.deactivate();
    } catch (error) {
      assert(false);
    }
  });

  test('tree view should be not created by default (shows welcome view)', () => {
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    assert(testExplorerController.getTreeView() === undefined);
  });

  test('tree view should call create tree view after a "CONNECTIONS_DID_CHANGE" event', async () => {
    const testConnectionController =
      mdbTestExtension.testExtensionController._connectionController;
    const testExplorerController =
      mdbTestExtension.testExtensionController._explorerController;

    testExplorerController.activateTreeView();

    const treeControllerStub = sinon.stub().returns(null);

    sinon.replace(
      testExplorerController.getTreeController(),
      'activateTreeViewEventHandlers',
      treeControllerStub
    );

    const vscodeCreateTreeViewStub = sinon.stub().returns('');

    sinon.replace(vscode.window, 'createTreeView', vscodeCreateTreeViewStub);

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
      await testConnectionController.disconnect();

      assert(vscodeCreateTreeViewStub.called);
    } catch (error) {
      assert(false);
    }
  });
});
