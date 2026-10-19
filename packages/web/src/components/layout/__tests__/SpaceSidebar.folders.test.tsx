import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isPublicSpace, type SpaceFolder, type SpaceLayoutItem } from '@concord/shared';
import { useSpaceStore, type TaggedSpace } from '../../../stores/spaceStore';
import { resolveSpaceLayout, spacesInLayoutOrder } from '../../../utils/spaceLayout';

describe('SpaceSidebar — Space Folders & Drag and Drop Architecture', () => {
  const privateSpaces: TaggedSpace[] = [
    {
      id: 'priv-1',
      name: 'Friends Lounge',
      ownerId: 'u1',
      inviteCode: 'inv1',
      type: 'private',
      visibility: 'private',
      directoryListed: false,
      createdAt: 1000,
    },
    {
      id: 'priv-2',
      name: 'Secret Gaming',
      ownerId: 'u1',
      inviteCode: 'inv2',
      type: 'private',
      visibility: 'private',
      directoryListed: false,
      createdAt: 2000,
    },
    {
      id: 'priv-3',
      name: 'Work Projects',
      ownerId: 'u1',
      inviteCode: 'inv3',
      type: 'private',
      visibility: 'private',
      directoryListed: false,
      createdAt: 3000,
    },
  ];

  const publicSpaces: TaggedSpace[] = [
    {
      id: 'pub-1',
      name: 'Open Guild',
      ownerId: 'u1',
      inviteCode: 'inv4',
      type: 'public',
      slug: 'open-guild',
      category: 'gaming',
      publicationStatus: 'published',
      visibility: 'public',
      directoryListed: true,
      createdAt: 4000,
    },
    {
      id: 'pub-2',
      name: 'Community Hangout',
      ownerId: 'u1',
      inviteCode: 'inv5',
      type: 'public',
      slug: 'community-hangout',
      category: 'social',
      publicationStatus: 'published',
      visibility: 'public',
      directoryListed: true,
      createdAt: 5000,
    },
  ];

  beforeEach(() => {
    useSpaceStore.setState({
      spaces: [...privateSpaces, ...publicSpaces],
      folders: [],
      spaceLayout: null,
    });
  });

  it('creates a new folder when merging two spaces', () => {
    const spaces = useSpaceStore.getState().spaces;
    const folders: SpaceFolder[] = [
      {
        id: 'folder-1',
        userId: 'u1',
        name: 'Games',
        color: '#86efac',
        position: 0,
        spaceIds: ['priv-1', 'priv-2'],
      },
    ];
    const layout: SpaceLayoutItem[] = [
      { t: 'f', id: 'folder-1' },
      { t: 's', id: 'priv-3' },
      { t: 's', id: 'pub-1' },
      { t: 's', id: 'pub-2' },
    ];

    const resolved = resolveSpaceLayout(spaces, layout, folders);
    expect(resolved).toHaveLength(4);
    expect(resolved[0].type).toBe('folder');
    if (resolved[0].type === 'folder') {
      expect(resolved[0].folder.name).toBe('Games');
      expect(resolved[0].spaces.map((s) => s.id)).toEqual(['priv-1', 'priv-2']);
    }
  });

  it('strictly isolates private vs public spaces in partitions and folders', () => {
    const spaces = useSpaceStore.getState().spaces;
    const spaceMap = new Map(spaces.map((s) => [s.id, s]));

    // Check classification
    expect(isPublicSpace(spaceMap.get('priv-1')!)).toBe(false);
    expect(isPublicSpace(spaceMap.get('pub-1')!)).toBe(true);

    // Private folder contains only private spaces
    const privateFolder: SpaceFolder = {
      id: 'priv-folder',
      userId: 'u1',
      name: 'Private Group',
      color: null,
      position: 0,
      spaceIds: ['priv-1', 'priv-2'],
    };

    const resolved = resolveSpaceLayout(spaces, [{ t: 'f', id: 'priv-folder' }], [privateFolder]);
    const folderItem = resolved[0];
    expect(folderItem.type).toBe('folder');
    if (folderItem.type === 'folder') {
      // Must not contain any public space
      const hasAnyPublic = folderItem.spaces.some((s) => isPublicSpace(s));
      expect(hasAnyPublic).toBe(false);
    }
  });

  it('dissolves folder when removing spaces leaves fewer than 2 spaces', () => {
    // A folder with 2 spaces where 1 is removed
    const originalFolder: SpaceFolder = {
      id: 'folder-temp',
      userId: 'u1',
      name: null,
      color: null,
      position: 0,
      spaceIds: ['priv-1', 'priv-2'],
    };

    // Simulate removing priv-1: only priv-2 remains
    const remainingSpaceIds = ['priv-2'];
    const updatedFolder = { ...originalFolder, spaceIds: remainingSpaceIds };

    // Layout should dissolve folders with < 2 members into standalone spaces
    let layoutItems: Array<{ type: 'space'; spaceId: string } | { type: 'folder'; folder: SpaceFolder }> = [
      { type: 'folder', folder: updatedFolder },
      { type: 'space', spaceId: 'priv-1' }, // removed space placed in rail
    ];

    const dissolved = layoutItems.flatMap((item) => {
      if (item.type === 'folder' && item.folder.spaceIds.length < 2) {
        return item.folder.spaceIds.map((id) => ({ type: 'space' as const, spaceId: id }));
      }
      return [item];
    });

    expect(dissolved).toEqual([
      { type: 'space', spaceId: 'priv-2' },
      { type: 'space', spaceId: 'priv-1' },
    ]);
  });

  it('preserves spaces in layout order top to bottom across folders', () => {
    const spaces = useSpaceStore.getState().spaces;
    const folders: SpaceFolder[] = [
      {
        id: 'f1',
        userId: 'u1',
        name: 'Folder One',
        color: '#fb7185',
        position: 0,
        spaceIds: ['priv-2', 'priv-1'],
      },
    ];
    const layout: SpaceLayoutItem[] = [
      { t: 'f', id: 'f1' },
      { t: 's', id: 'priv-3' },
    ];

    const resolved = resolveSpaceLayout(spaces, layout, folders);
    const flattened = spacesInLayoutOrder(resolved);

    expect(flattened.map((s) => s.id)).toEqual(['priv-2', 'priv-1', 'priv-3', 'pub-1', 'pub-2']);
  });

  it('optimistically updates folders in spaceStore updateSpaceLayout', async () => {
    const foldersPayload: Record<string, { name: string | null; color: string | null; spaceIds: string[] }> = {
      'folder-10': {
        name: 'Work',
        color: '#7dd3fc',
        spaceIds: ['priv-1', 'priv-3'],
      },
    };

    const items: SpaceLayoutItem[] = [
      { t: 'f', id: 'folder-10' },
      { t: 's', id: 'priv-2' },
    ];

    await useSpaceStore.getState().updateSpaceLayout(items, foldersPayload);

    const state = useSpaceStore.getState();
    expect(state.spaceLayout).toEqual(items);
    expect(state.folders).toHaveLength(1);
    expect(state.folders[0].name).toBe('Work');
    expect(state.folders[0].color).toBe('#7dd3fc');
    expect(state.folders[0].spaceIds).toEqual(['priv-1', 'priv-3']);
  });
});
