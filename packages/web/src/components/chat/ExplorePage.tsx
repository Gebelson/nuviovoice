import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SPACE_CATEGORIES, type DirectoryEntry, type SpaceCategory } from '@concord/shared';
import { api } from '../../api/client';
import { useExploreStore, type TaggedExploreSpace } from '../../stores/exploreStore';
import { useInstanceStore } from '../../stores/instanceStore';
import { useDirectoryStore } from '../../stores/directoryStore';
import { useSpaceStore } from '../../stores/spaceStore';
import { useUIStore } from '../../stores/uiStore';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Mascot } from '../ui/Mascot';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { MemberListToggleButton } from '../layout/MemberListToggleButton';
import { useFormatters } from '../../i18n/formatters';
import { describeError } from '../../i18n/errors';
import { deliveringHost } from '../../utils/identity';
import { getSpaceGradient } from '../../utils/gradients';
import { SpaceCard } from './SpaceCard';
import { OuterSpaceSection } from './OuterSpaceSection';
import { ConnectionChips } from './ConnectionChips';
import { InstanceDiscoveryHint } from './InstanceDiscoveryHint';

type ExploreSortOption = 'popular' | 'relevant' | 'recent';

/** How long the search box waits after the last keystroke before both sections re-query. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The connected origins as one comparable string. Inner Space fans out over
 * exactly these, so an unchanged value means an unchanged fan-out, whatever
 * else moved in the instance list.
 */
function connectedOriginsKey(instances: { origin: string; status: string }[]): string {
  return instances.filter((i) => i.status === 'connected').map((i) => i.origin).sort().join('\n');
}

export function ExplorePage() {
  const { t } = useTranslation(['spaces', 'common']);
  const f = useFormatters();
  const navigate = useNavigate();
  const setCurrentSpace = useSpaceStore((s) => s.setCurrentSpace);
  const openModal = useUIStore((s) => s.openModal);

  const spaces = useExploreStore((s) => s.spaces);
  const isLoading = useExploreStore((s) => s.isLoading);
  const error = useExploreStore((s) => s.error);
  const unansweredOrigins = useExploreStore((s) => s.unansweredOrigins);
  const searchQuery = useExploreStore((s) => s.searchQuery);
  const resultsQuery = useExploreStore((s) => s.resultsQuery);
  const selectedCategory = useExploreStore((s) => s.selectedCategory);
  const sortBy = useExploreStore((s) => s.sortBy);
  const setSearchQuery = useExploreStore((s) => s.setSearchQuery);
  const setSelectedCategory = useExploreStore((s) => s.setSelectedCategory);
  const setSortBy = useExploreStore((s) => s.setSortBy);
  const fetchSpaces = useExploreStore((s) => s.fetchSpaces);
  const fetchMyRequests = useExploreStore((s) => s.fetchMyRequests);
  const joinPublicSpace = useExploreStore((s) => s.joinSpace);
  const fetchDirectory = useDirectoryStore((s) => s.fetch);

  const [joinedCollapsed, setJoinedCollapsed] = useState(false);
  const [previewSpace, setPreviewSpace] = useState<TaggedExploreSpace | null>(null);
  const [previewJoining, setPreviewJoining] = useState(false);

  // Whether the home instance browses the directory at all: DIRECTORY_ENDPOINT
  // non-empty and the admin's browse setting on, which the server reports as
  // one flag. Not the admin's listing opt-in (`directoryEnabled`): a fresh
  // instance that lists nothing must still be able to browse. Read from the
  // public instance info so an instance with no directory never flashes the
  // Outer Space header; the store's own status starts idle and cannot answer
  // this before its first fetch.
  //
  // Null until the answer arrives, and null is not false: the section gates on
  // an explicit `true`, and the hint below says nothing about the browse
  // setting off an unknown, exactly as it does for the endpoint.
  const [directoryAvailable, setDirectoryAvailable] = useState<boolean | null>(null);
  // Whether this instance has a DIRECTORY_ENDPOINT at all, reported on its own
  // so a client can tell a missing endpoint from an admin's switch. Null until
  // the answer arrives; the hint below offers nothing off an unknown.
  const [directoryConfigured, setDirectoryConfigured] = useState<boolean | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchSpaces();
    fetchMyRequests();
  }, [fetchSpaces, fetchMyRequests]);

  // Whether this component is still on screen, for the two directory facts
  // below: they are written from a promise that outlives an unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /**
   * Re-read the public instance info, the one document that carries both
   * directory facts and that every signed-in user may read. Used on mount and
   * again after the admin turns browsing on from the hint, which is a change
   * this page cannot see any other way: the browse setting itself lives on the
   * admin-only `InstanceAdminSettings`, so the page reads its effect
   * (`directoryAvailable`) rather than the setting.
   *
   * Never rejects. An unreachable instance leaves both facts as they were,
   * which on mount is unknown: the section stays absent and the hint offers
   * nothing. An older server without the fields lands in the strict
   * comparisons and reads as false rather than throwing.
   */
  const readInstanceInfo = useCallback(async (): Promise<void> => {
    try {
      const info = await api.instance.info();
      if (!mounted.current) return;
      setDirectoryAvailable(info.directoryAvailable === true);
      setDirectoryConfigured(info.directoryConfigured === true);
    } catch {
      // Left as it was on purpose; see above.
    }
  }, []);

  useEffect(() => {
    void readInstanceInfo();
  }, [readInstanceInfo]);

  // Debounced search, one timer for both sections. The directory is only
  // queried on an instance that has one; with it off the section is absent
  // and nothing should hit the proxy.
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSpaces(value || undefined);
      if (directoryAvailable === true) fetchDirectory(value);
    }, SEARCH_DEBOUNCE_MS);
  }, [setSearchQuery, fetchSpaces, fetchDirectory, directoryAvailable]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleJoinSuccess = (spaceId: string) => {
    setCurrentSpace(spaceId);
    navigate(`/channels/${spaceId}`);
  };

  const handleConnect = useCallback((entry: DirectoryEntry) => {
    openModal('connectAndJoin', { entry });
  }, [openModal]);

  // The instances Inner Space fans out over, as one stable string: a new
  // value means the fan-out would return something else now. Derived in the
  // selector so a render with an unchanged set is not a new value.
  const connectedKey = useInstanceStore((s) => connectedOriginsKey(s.instances));

  // Startup fills the instance list one origin at a time. Both store actions
  // await `waitForAutoConnect()` anyway, so a refetch per arrival would ask
  // for the same answer K times; the page holds off until the list is whole.
  const autoConnectDone = useInstanceStore((s) => s._autoConnectDone);

  // The query the refetch below should use, read at call time: a keystroke
  // must not refetch outside the search debounce.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  // What the page fetched Inner Space for last. The mount fetch above covers
  // the first value, so the effect records it rather than fetching again.
  const fetchedKey = useRef<string | null>(null);

  const refetchInner = useCallback((key: string) => {
    fetchedKey.current = key;
    fetchSpaces(searchQueryRef.current || undefined);
    fetchMyRequests();
  }, [fetchSpaces, fetchMyRequests]);

  // Inner Space is a snapshot: `fetchSpaces` evaluates the fan-out once per
  // call. When a connection is made, lost or dropped while this page is
  // open, that snapshot is stale, and since Outer Space dedupes at render
  // the same space would be on the page twice with contradictory actions
  // (the stale "Join Space" card and a fresh "Connect and join" one).
  // Refetching whenever the connected set changes keeps the two sections
  // disjoint, and covers the other direction too: a space joined or
  // requested on an origin that just came back appears in Inner without a
  // reload.
  useEffect(() => {
    if (!autoConnectDone || fetchedKey.current === null) {
      // Not a fetch: whatever the set is now, the mount fetch (or the one
      // that follows this gate opening) covers it.
      fetchedKey.current = connectedKey;
      return;
    }
    if (fetchedKey.current === connectedKey) return;
    refetchInner(connectedKey);
  }, [connectedKey, autoConnectDone, refetchInner]);

  // A connection came back through the chips row. Recording the key here
  // keeps the effect above from fetching the same thing again when the
  // instance list catches up; a recovery that does not change that set (a
  // token reconnect of an instance that stayed in it) is covered here alone.
  const handleConnectionRecovered = useCallback(() => {
    refetchInner(connectedOriginsKey(useInstanceStore.getState().instances));
  }, [refetchInner]);

  // Space discovery was just turned on from the hint below the chips. The
  // connected set has not moved, so the effect above has nothing to do; what
  // changed is what the home instance answers, and Inner Space is a snapshot
  // of that answer.
  const handleDiscoveryEnabled = useCallback(() => {
    fetchSpaces(searchQueryRef.current || undefined);
    fetchMyRequests();
  }, [fetchSpaces, fetchMyRequests]);

  // The hosts behind those origins, for the notice. Home is the empty
  // sentinel, which `deliveringHost` resolves to the host this client is
  // served from: the same instance its home client talks to.
  const unansweredHosts = useMemo(
    () => unansweredOrigins.map((origin) => deliveringHost(origin)),
    [unansweredOrigins],
  );

  const unjoinedSpaces = useMemo(
    () => spaces.filter(s => !s.joined),
    [spaces],
  );
  const joinedSpaces = useMemo(
    () => spaces.filter(s => s.joined),
    [spaces],
  );

  const hasAnySpaces = spaces.length > 0;
  const hasUnjoined = unjoinedSpaces.length > 0;
  const hasJoined = joinedSpaces.length > 0;

  const handlePreviewJoin = async () => {
    if (!previewSpace) return;
    setPreviewJoining(true);
    try {
      const joined = await joinPublicSpace(previewSpace.id, previewSpace._instanceOrigin);
      setPreviewSpace(null);
      handleJoinSuccess(joined.id);
    } catch {
      // handled in store/card
    } finally {
      setPreviewJoining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-chat h-full">
      {/* Header */}
      <div className="h-12 px-4 flex items-center shadow-header flex-shrink-0 z-10 bg-surface-chat gap-2">
        <div className="flex items-center gap-2 mr-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-txt-tertiary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" />
          </svg>
          <span className="font-bold text-txt-primary">{t('spaces:explore.title')}</span>
        </div>

        <div className="w-[1px] h-6 bg-surface-elevated mx-1" />

        <div className="relative flex-1 max-w-xs ml-1">
          <input
            type="text"
            placeholder={t('spaces:explore.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input-search w-full"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-tertiary hover:text-txt-secondary"
              aria-label={t('common:actions.clear')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal('createPublicSpace')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/85 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            <span>{t('spaces:explore.createPublicSpace')}</span>
          </button>
          <MemberListToggleButton />
        </div>
      </div>

      {/* Content: Inner Space on top, Outer Space below it, in that order whatever either holds */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-10">
          {/* Inner Space: the home instance and every connected instance */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-txt-tertiary">
                  {t('spaces:explore.inner.title')}
                </span>
                <p className="text-[13px] text-txt-tertiary">{t('spaces:explore.inner.subtitle')}</p>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-txt-tertiary">{t('spaces:explore.sort.label')}:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ExploreSortOption)}
                  className="input-standard py-1 px-2.5 text-xs"
                >
                  <option value="popular">{t('spaces:explore.sort.popular')}</option>
                  <option value="relevant">{t('spaces:explore.sort.relevant')}</option>
                  <option value="recent">{t('spaces:explore.sort.recent')}</option>
                </select>
              </div>
            </div>

            {/* Category filter bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-accent-primary text-white'
                    : 'bg-surface-elevated text-txt-secondary hover:text-txt-primary'
                }`}
              >
                {t('spaces:explore.categories.all')}
              </button>
              {SPACE_CATEGORIES.map((cat: SpaceCategory) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-accent-primary text-white'
                      : 'bg-surface-elevated text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  {t(`spaces:explore.categories.${cat}`)}
                </button>
              ))}
            </div>

            {/* Connections that are out, with the way back in; nothing when all are healthy */}
            <ConnectionChips onRecovered={handleConnectionRecovered} />

            {/* Why this instance shows what it shows, and the admin's way to change it */}
            <InstanceDiscoveryHint
              directoryConfigured={directoryConfigured}
              directoryAvailable={directoryAvailable}
              onDiscoveryEnabled={handleDiscoveryEnabled}
              onBrowseEnabled={readInstanceInfo}
            />

            {/* One instance of several did not answer. Without this the page
                renders the survivors' spaces and says nothing, and a user who
                knows a space is on the missing instance reads it as deleted. */}
            {unansweredHosts.length > 0 && (
              <div className="mb-4 p-2.5 bg-accent-amber/10 border border-accent-amber/30 rounded text-[13px] text-accent-amber">
                {t('spaces:explore.inner.unreachable', {
                  count: unansweredHosts.length === 1 ? 1 : 2,
                  hosts: unansweredHosts.join(', '),
                })}
              </div>
            )}

            {isLoading && spaces.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="p-3 bg-accent-rose/10 border border-accent-rose/30 rounded text-sm text-txt-danger">
                {error.kind === 'none_answered'
                  ? t('spaces:explore.inner.noneAnswered')
                  : describeError(error.cause)}
              </div>
            ) : !hasAnySpaces ? (
              /* True empty state: no discoverable Inner spaces at all. Outer Space still renders below. */
              <div className="flex flex-col items-center justify-center h-64 opacity-80">
                <Mascot state="lonely" className="w-32 h-32 mb-3" />
                <p className="text-txt-tertiary text-sm">
                  {resultsQuery || selectedCategory !== 'all'
                    ? t('spaces:explore.noMatches')
                    : t('spaces:explore.empty')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Unjoined spaces grid */}
                {hasUnjoined && (
                  <div className="card-grid">
                    {unjoinedSpaces.map((space) => (
                      <SpaceCard
                        key={`${space.id}:${space._instanceOrigin}`}
                        space={space}
                        onJoinSuccess={handleJoinSuccess}
                        onPreviewSpace={(s) => setPreviewSpace(s)}
                      />
                    ))}
                  </div>
                )}

                {/* Joined spaces section */}
                {hasJoined && (
                  <div>
                    <button
                      onClick={() => setJoinedCollapsed(!joinedCollapsed)}
                      className="flex items-center gap-2 mb-3 group"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className={`text-txt-tertiary transition-transform ${joinedCollapsed ? '-rotate-90' : ''}`}
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                      <span className="text-xs font-medium text-txt-tertiary group-hover:text-txt-secondary transition-colors">
                        {t('spaces:explore.joinedSection')}
                      </span>
                      <span className="text-xs text-txt-tertiary/60">
                        {f.formatNumber(joinedSpaces.length)}
                      </span>
                    </button>

                    {!joinedCollapsed && (
                      <div className="card-grid">
                        {joinedSpaces.map((space) => (
                          <SpaceCard
                            key={`${space.id}:${space._instanceOrigin}`}
                            space={space}
                            onJoinSuccess={handleJoinSuccess}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Outer Space: the directory, only on an instance that browses one */}
          {directoryAvailable === true && (
            <OuterSpaceSection query={searchQuery} onConnect={handleConnect} />
          )}
        </div>
      </div>

      {/* Public Space Preview Modal (inspect before joining) */}
      <Modal
        isOpen={previewSpace !== null}
        onClose={() => setPreviewSpace(null)}
        title={previewSpace?.name ?? ''}
        maxWidth="max-w-lg"
      >
        {previewSpace && (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-border-soft bg-surface-channel">
              <div className="w-full aspect-[15/4] relative overflow-hidden">
                {previewSpace.banner ? (
                  <img
                    src={
                      previewSpace.banner.startsWith('http') || previewSpace.banner.startsWith('/')
                        ? previewSpace.banner
                        : `${previewSpace._instanceOrigin || ''}/api/uploads/${previewSpace.banner}`
                    }
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background: getSpaceGradient(previewSpace.id, previewSpace.name, previewSpace.avatarColor).gradient,
                    }}
                  />
                )}
              </div>
              <div className="p-4 pt-0 relative">
                <div className="-mt-7 mb-2 flex items-end justify-between">
                  <div className="p-1 rounded-xl bg-surface-channel shadow-md">
                    <Avatar
                      src={previewSpace.icon}
                      name={previewSpace.name}
                      size={48}
                      userId={previewSpace.id}
                      avatarColor={previewSpace.avatarColor}
                      palette="space"
                    />
                  </div>
                  {previewSpace.category && (
                    <span className="text-xs px-2.5 py-0.5 rounded bg-surface-elevated text-txt-secondary font-medium">
                      {t(`spaces:explore.categories.${previewSpace.category as SpaceCategory}`)}
                    </span>
                  )}
                </div>

                <p className="text-sm text-txt-secondary">
                  {previewSpace.fullDescription || previewSpace.description || t('spaces:explore.noDescription')}
                </p>

                {previewSpace.tags && previewSpace.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {previewSpace.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-txt-tertiary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {previewSpace.rules && (
                  <div className="mt-4 pt-3 border-t border-border-soft">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-txt-tertiary mb-1">
                      {t('spaces:createPublic.fields.rules')}
                    </div>
                    <p className="text-xs text-txt-secondary whitespace-pre-line">{previewSpace.rules}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-txt-tertiary">
                  <span>{t('spaces:explore.memberCount', { count: previewSpace.memberCount })}</span>
                  {previewSpace.slug && <span className="font-mono">/{previewSpace.slug}</span>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewSpace(null)}
                className="px-4 py-2 text-sm text-txt-secondary hover:text-txt-primary"
              >
                {t('common:actions.close')}
              </button>
              {previewSpace.visibility === 'public' && (
                <button
                  type="button"
                  onClick={handlePreviewJoin}
                  disabled={previewJoining}
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/85 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  {previewJoining ? t('spaces:explore.joining') : t('spaces:explore.join')}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
