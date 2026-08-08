/**
 * Smoke test: the app mounts without throwing. State settles inside act(), so
 * this fails on a render error rather than only warning about one.
 */
import 'react-native';
import React from 'react';
import { it, expect } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import App from '../App';

it('renders without crashing', async () => {
  let tree: any;
  await act(async () => { tree = create(<App />); });
  await act(async () => { await Promise.resolve(); });
  expect(tree.toJSON()).toBeTruthy();
  await act(async () => { tree.unmount(); });
});
