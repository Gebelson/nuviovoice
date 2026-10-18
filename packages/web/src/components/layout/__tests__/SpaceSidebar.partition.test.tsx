import { describe, it, expect, beforeEach } from 'vitest';
import { isPublicSpace } from '@concord/shared';
import { useSpaceStore } from '../../../stores/spaceStore';

describe('SpaceSidebar — Private vs Public Spaces Partitioning', () => {
  beforeEach(() => {
    useSpaceStore.setState({
      spaces: [
        {
          id: 'priv-1',
          name: 'Private Friends',
          ownerId: 'u1',
          inviteCode: 'inv1',
          type: 'private',
          visibility: 'private',
          directoryListed: false,
          createdAt: 1000,
        },
        {
          id: 'pub-1',
          name: 'Public Gamers',
          ownerId: 'u1',
          inviteCode: 'inv2',
          type: 'public',
          slug: 'public-gamers',
          category: 'gaming',
          publicationStatus: 'published',
          visibility: 'public',
          directoryListed: true,
          createdAt: 2000,
        },
        {
          id: 'priv-2',
          name: 'Private Team',
          ownerId: 'u1',
          inviteCode: 'inv3',
          type: 'private',
          visibility: 'private',
          directoryListed: false,
          createdAt: 3000,
        },
      ],
      folders: [],
      layoutOrder: [
        { type: 'space', id: 'priv-1' },
        { type: 'space', id: 'pub-1' },
        { type: 'space', id: 'priv-2' },
      ],
    });
  });

  it('accurately classifies private vs public spaces via isPublicSpace()', () => {
    const spaces = useSpaceStore.getState().spaces;
    expect(isPublicSpace(spaces[0])).toBe(false);
    expect(isPublicSpace(spaces[1])).toBe(true);
    expect(isPublicSpace(spaces[2])).toBe(false);
  });

  it('partitions layout items into private spaces (above +) and public spaces (below +)', () => {
    const { spaces, layoutOrder: layoutItems } = useSpaceStore.getState();
    const spaceMap = new Map(spaces.map((s) => [s.id, s]));

    const privateItems = layoutItems.filter((item) => {
      if (item.type === 'space') {
        const s = spaceMap.get(item.id);
        return s ? !isPublicSpace(s) : false;
      }
      return false;
    });

    const publicItems = layoutItems.filter((item) => {
      if (item.type === 'space') {
        const s = spaceMap.get(item.id);
        return s ? isPublicSpace(s) : false;
      }
      return false;
    });

    expect(privateItems.map((i) => i.id)).toEqual(['priv-1', 'priv-2']);
    expect(publicItems.map((i) => i.id)).toEqual(['pub-1']);
  });
});
