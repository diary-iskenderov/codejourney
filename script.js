document.documentElement.classList.add('js-ready');

const firebaseConfig = {
  apiKey: 'AIzaSyCr5qnIxLVdYR3F8LdeU-dItqFo-O5yFTQ',
  authDomain: 'iskenderov-pro.firebaseapp.com',
  projectId: 'iskenderov-pro',
  storageBucket: 'iskenderov-pro.firebasestorage.app',
  messagingSenderId: '909778828185',
  appId: '1:909778828185:web:7f3a1c877246a747af7108',
  measurementId: 'G-0Y485H5TBL',
};

let firebaseContextPromise = null;

const getFirebaseContext = async () => {
  if (!firebaseContextPromise) {
    firebaseContextPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js'),
    ]).then(async ([appModule, authModule, firestoreModule]) => {
      const firebaseApp = appModule.initializeApp(firebaseConfig);
      const auth = authModule.getAuth(firebaseApp);
      const db = firestoreModule.getFirestore(firebaseApp);
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      } catch (error) {
        console.warn('Failed to set browserLocalPersistence:', error);
      }

      return {
        auth,
        db,
        provider,
        collection: firestoreModule.collection,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        limit: firestoreModule.limit,
        onAuthStateChanged: authModule.onAuthStateChanged,
        orderBy: firestoreModule.orderBy,
        query: firestoreModule.query,
        serverTimestamp: firestoreModule.serverTimestamp,
        setDoc: firestoreModule.setDoc,
        signInWithPopup: authModule.signInWithPopup,
        signOut: authModule.signOut,
        where: firestoreModule.where,
      };
    });
  }

  return firebaseContextPromise;
};

document.addEventListener('DOMContentLoaded', () => {
  const yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  const header = document.querySelector('.site-header');
  const fixedNav = document.querySelector('.bottom-nav');
  const getAnchorOffset = () => {
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
    const navHeight = fixedNav instanceof HTMLElement ? fixedNav.offsetHeight : 0;
    return headerHeight + navHeight + 18;
  };

  const scrollToAnchor = (hash, behavior = 'smooth') => {
    if (!hash || !hash.startsWith('#')) return;
    const target = document.querySelector(hash);
    if (!(target instanceof HTMLElement)) return;

    const top = target.getBoundingClientRect().top + window.scrollY - getAnchorOffset();
    window.scrollTo({ top: Math.max(0, top), behavior });
  };

  const inPageLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
  inPageLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (link.dataset.modalTarget || link.target === '_blank') return;

      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      event.preventDefault();
      scrollToAnchor(href);
      history.replaceState(null, '', href);
    });
  });

  if (window.location.hash) {
    const navigationEntries =
      typeof performance !== 'undefined' && performance.getEntriesByType
        ? performance.getEntriesByType('navigation')
        : [];
    const navigationType =
      navigationEntries.length > 0 && navigationEntries[0] && 'type' in navigationEntries[0]
        ? navigationEntries[0].type
        : '';

    // On hard refresh keep landing at top instead of jumping to previous hash section.
    if (navigationType === 'reload') {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        scrollToAnchor(window.location.hash, 'auto');
      });
    }
  }

  const modalTriggers = Array.from(document.querySelectorAll('[data-modal-target]'));
  const modalCloseButtons = Array.from(document.querySelectorAll('[data-modal-close]'));
  const authStatus = document.querySelector('[data-auth-status]');
  const googleLoginBtn = document.querySelector('.google-login-btn');
  const authUserCard = document.querySelector('[data-auth-user]');
  const authName = document.querySelector('[data-auth-name]');
  const authEmail = document.querySelector('[data-auth-email]');
  const authPlan = document.querySelector('[data-auth-plan]');
  const authAvatar = document.querySelector('[data-auth-avatar]');
  const authAvatarFallback = document.querySelector('[data-auth-avatar-fallback]');
  const authSignoutBtn = document.querySelector('[data-auth-signout]');
  const authTitle = document.getElementById('profile-modal-title');
  const authCopy = document.querySelector('.auth-modal__copy');
  const headerProfileBtn = document.querySelector('[data-header-profile-btn]');
  const headerProfileLabel = document.querySelector('[data-header-profile-label]');
  const profileCacheKey = 'codejourney.profile.cache.v1';
  const leaderboardList = document.querySelector('[data-leaderboard-list]');
  const leaderboardMeta = document.querySelector('[data-leaderboard-meta]');
  const friendsList = document.querySelector('[data-friends-list]');
  const friendsMeta = document.querySelector('[data-friends-meta]');
  const requestsMeta = document.querySelector('[data-requests-meta]');
  const communityRefreshBtn = document.querySelector('[data-community-refresh]');
  const communityJumpButtons = Array.from(document.querySelectorAll('[data-community-jump]'));
  let activeModal = null;
  let activeModalTrigger = null;
  let authObserverInitialized = false;
  let communityLoadRequestId = 0;

  const setAuthStatus = (message = '', state = 'info') => {
    if (!(authStatus instanceof HTMLElement)) return;

    if (!message) {
      authStatus.hidden = true;
      authStatus.textContent = '';
      authStatus.removeAttribute('data-state');
      return;
    }

    authStatus.hidden = false;
    authStatus.textContent = message;
    authStatus.dataset.state = state;
  };

  const setGoogleButtonBusy = (isBusy) => {
    if (!(googleLoginBtn instanceof HTMLElement)) return;

    googleLoginBtn.classList.toggle('is-busy', isBusy);
    googleLoginBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  };

  const setElementHidden = (element, isHidden) => {
    if (!(element instanceof HTMLElement)) return;
    element.hidden = isHidden;
    element.style.display = isHidden ? 'none' : '';
  };

  const getDisplayName = (profile = {}) => {
    const fromName = String(profile.name || '').trim();
    if (fromName) {
      return fromName;
    }
    const fromEmail = String(profile.email || '').trim();
    if (fromEmail && fromEmail.includes('@')) {
      return fromEmail.split('@')[0];
    }
    return 'ПРОФИЛЬ';
  };

  const renderHeaderProfileState = (profile = null) => {
    if (!(headerProfileLabel instanceof HTMLElement)) return;

    if (!profile) {
      headerProfileLabel.textContent = 'ПРОФИЛЬ';
      if (headerProfileBtn instanceof HTMLElement) {
        headerProfileBtn.setAttribute('aria-label', 'Профиль');
      }
      return;
    }

    const shortName = getDisplayName(profile);
    headerProfileLabel.textContent = shortName;
    if (headerProfileBtn instanceof HTMLElement) {
      headerProfileBtn.setAttribute('aria-label', `Профиль: ${shortName}`);
    }
  };

  const normalizeProfile = (profile = {}) => {
    const normalized = {
      name: String(profile.name || '').trim(),
      email: String(profile.email || '').trim(),
      photoUrl: String(profile.photoUrl || '').trim(),
      plan: String(profile.plan || 'free').trim() || 'free',
      role: String(profile.role || 'user').trim() || 'user',
    };
    return normalized;
  };

  const readCachedProfile = () => {
    try {
      const raw = window.localStorage.getItem(profileCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return normalizeProfile(parsed);
    } catch (error) {
      console.warn('Failed to read cached profile:', error);
      return null;
    }
  };

  const writeCachedProfile = (profile = {}) => {
    try {
      const normalized = normalizeProfile(profile);
      if (!normalized.name && !normalized.email) return;
      window.localStorage.setItem(profileCacheKey, JSON.stringify(normalized));
    } catch (error) {
      console.warn('Failed to write cached profile:', error);
    }
  };

  const clearCachedProfile = () => {
    try {
      window.localStorage.removeItem(profileCacheKey);
    } catch (error) {
      console.warn('Failed to clear cached profile:', error);
    }
  };

  const buildProfileFromAuthUser = (user) =>
    normalizeProfile({
      name: user.displayName || user.email?.split('@')[0] || 'CodeJourney User',
      email: user.email || '',
      photoUrl: user.photoURL || '',
      plan: 'free',
      role: 'user',
    });

  const toInt = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
    return 0;
  };

  const createListItem = (text, className = '') => {
    const li = document.createElement('li');
    li.textContent = text;
    if (className) {
      li.className = className;
    }
    return li;
  };

  const replaceListItems = (listNode, items = []) => {
    if (!(listNode instanceof HTMLElement)) return;
    listNode.innerHTML = '';
    items.forEach((item) => listNode.appendChild(item));
  };

  const setCommunityRefreshBusy = (isBusy) => {
    if (!(communityRefreshBtn instanceof HTMLButtonElement)) return;
    communityRefreshBtn.disabled = isBusy;
    communityRefreshBtn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  };

  const renderCommunitySignedOut = () => {
    if (leaderboardMeta instanceof HTMLElement) {
      leaderboardMeta.textContent = 'Войдите через Google, чтобы увидеть общий рейтинг.';
    }
    if (friendsMeta instanceof HTMLElement) {
      friendsMeta.textContent = 'После входа здесь отобразится список друзей из приложения.';
    }
    if (requestsMeta instanceof HTMLElement) {
      requestsMeta.textContent = 'Заявок: 0';
    }
    replaceListItems(leaderboardList, [createListItem('Рейтинг доступен после входа.', 'community-empty')]);
    replaceListItems(friendsList, [createListItem('Список друзей появится после входа.', 'community-empty')]);
    setCommunityRefreshBusy(false);
  };

  const renderLeaderboardRows = (rows = [], currentUid = '') => {
    if (!(leaderboardMeta instanceof HTMLElement)) return;

    if (!rows.length) {
      leaderboardMeta.textContent =
        'В этой базе пока нет пользователей. Если в приложении пользователи есть, сайт подключён к другому Firebase-проекту.';
      replaceListItems(leaderboardList, [createListItem('Список пока пуст.', 'community-empty')]);
      return;
    }

    leaderboardMeta.textContent = `Показано ${rows.length} пользователей по полю totalXp.`;
    const items = rows.map((row, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const name = String(row.name || 'Пользователь');
      const xp = toInt(row.totalXp);
      const country = row.countryCode ? ` · ${String(row.countryCode).toUpperCase()}` : '';
      const mine = row.uid === currentUid ? ' · Вы' : '';
      const li = document.createElement('li');
      li.innerHTML = `${medal} <span class="community-name"></span> <span class="community-xp"></span>`;
      const nameNode = li.querySelector('.community-name');
      const xpNode = li.querySelector('.community-xp');
      if (nameNode) nameNode.textContent = `${name}${country}${mine}`;
      if (xpNode) xpNode.textContent = `${xp} XP`;
      return li;
    });
    replaceListItems(leaderboardList, items);
  };

  const renderFriendsRows = (rows = [], pendingRequests = 0) => {
    if (requestsMeta instanceof HTMLElement) {
      requestsMeta.textContent = `Заявок: ${pendingRequests}`;
    }
    if (!(friendsMeta instanceof HTMLElement)) return;

    if (!rows.length) {
      friendsMeta.textContent = 'Пока нет друзей. Добавляйте через friendId в приложении.';
      replaceListItems(friendsList, [createListItem('Список друзей пуст.', 'community-empty')]);
      return;
    }

    friendsMeta.textContent = `Друзей: ${rows.length}`;
    const items = rows.map((row) => {
      const name = String(row.name || 'Пользователь');
      const xp = toInt(row.totalXp);
      const li = document.createElement('li');
      li.innerHTML = `<span class="community-name"></span> <span class="community-xp"></span>`;
      const nameNode = li.querySelector('.community-name');
      const xpNode = li.querySelector('.community-xp');
      if (nameNode) nameNode.textContent = name;
      if (xpNode) xpNode.textContent = `${xp} XP`;
      return li;
    });
    replaceListItems(friendsList, items);
  };

  const loadCommunityData = async (context, user) => {
    const requestId = ++communityLoadRequestId;

    if (!context || !user) {
      renderCommunitySignedOut();
      return;
    }

    if (leaderboardMeta instanceof HTMLElement) {
      leaderboardMeta.textContent = 'Загружаем рейтинг...';
    }
    if (friendsMeta instanceof HTMLElement) {
      friendsMeta.textContent = 'Загружаем друзей...';
    }
    setCommunityRefreshBusy(true);

    try {
      const leaderboardQuery = context.query(
        context.collection(context.db, 'users'),
        context.limit(500)
      );
      const leaderboardSnapshot = await context.getDocs(leaderboardQuery);
      if (requestId !== communityLoadRequestId) return;

      const leaderboardRows = leaderboardSnapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            uid: docSnap.id,
            name: data.name || 'Пользователь',
            totalXp: toInt(data.totalXp),
            countryCode: data.countryCode || '',
          };
        })
        .sort((a, b) => b.totalXp - a.totalXp)
        .slice(0, 20);
      renderLeaderboardRows(leaderboardRows, user.uid);
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      if (requestId !== communityLoadRequestId) return;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const ownSnapshot = await context.getDoc(context.doc(context.db, 'users', user.uid));
      if (requestId !== communityLoadRequestId) return;

      if (ownSnapshot.exists()) {
        const ownData = ownSnapshot.data() || {};
        renderLeaderboardRows(
          [
            {
              uid: user.uid,
              name: ownData.name || user.displayName || 'Вы',
              totalXp: toInt(ownData.totalXp),
              countryCode: ownData.countryCode || '',
            },
          ],
          user.uid
        );
        if (leaderboardMeta instanceof HTMLElement) {
          leaderboardMeta.textContent =
            code === 'permission-denied'
              ? 'Показан только ваш профиль. Для общего рейтинга нужно открыть чтение users для signed-in в Firestore Rules.'
              : 'Показан только ваш профиль. Общий рейтинг временно недоступен.';
        }
      } else {
        if (leaderboardMeta instanceof HTMLElement) {
          leaderboardMeta.textContent =
            code === 'permission-denied'
              ? 'Нет доступа к общему рейтингу (Firestore Rules).'
              : 'Не удалось загрузить лидерборд.';
        }
        replaceListItems(leaderboardList, [createListItem('Доступ к рейтингу пока недоступен.', 'community-empty')]);
      }
    }

    try {
      const myRef = context.doc(context.db, 'users', user.uid);
      const mySnapshot = await context.getDoc(myRef);
      if (requestId !== communityLoadRequestId) return;
      const myData = mySnapshot.exists() ? mySnapshot.data() : {};
      const friendUids = Array.isArray(myData.friendUids)
        ? myData.friendUids.filter((uid) => typeof uid === 'string' && uid.trim().length > 0)
        : [];

      let pendingCount = 0;
      try {
        const pendingQuery = context.query(
          context.collection(context.db, 'friend_requests'),
          context.where('toUid', '==', user.uid),
          context.where('status', '==', 'pending'),
          context.limit(50)
        );
        const pendingSnapshot = await context.getDocs(pendingQuery);
        pendingCount = pendingSnapshot.size;
      } catch (error) {
        console.error('Friend requests load failed:', error);
      }

      if (!friendUids.length) {
        renderFriendsRows([], pendingCount);
      } else {
        const uniqueFriendUids = Array.from(new Set(friendUids)).slice(0, 30);
        const friendSnapshots = await Promise.all(
          uniqueFriendUids.map((uid) => context.getDoc(context.doc(context.db, 'users', uid)))
        );
        if (requestId !== communityLoadRequestId) return;

        const friendRows = friendSnapshots
          .filter((snap) => snap.exists())
          .map((snap) => {
            const data = snap.data() || {};
            return {
              uid: snap.id,
              name: data.name || 'Пользователь',
              totalXp: toInt(data.totalXp),
            };
          })
          .sort((a, b) => b.totalXp - a.totalXp);

        renderFriendsRows(friendRows, pendingCount);
      }
    } catch (error) {
      console.error('Friends load failed:', error);
      if (requestId !== communityLoadRequestId) return;
      if (friendsMeta instanceof HTMLElement) {
        friendsMeta.textContent = 'Не удалось загрузить друзей (проверь Firestore Rules).';
      }
      replaceListItems(friendsList, [createListItem('Доступ к друзьям пока недоступен.', 'community-empty')]);
      if (requestsMeta instanceof HTMLElement) {
        requestsMeta.textContent = 'Заявок: —';
      }
    } finally {
      if (requestId === communityLoadRequestId) {
        setCommunityRefreshBusy(false);
      }
    }
  };

  const resetAuthView = () => {
    setElementHidden(authUserCard, true);
    setElementHidden(googleLoginBtn, false);
    setElementHidden(authSignoutBtn, true);
    renderHeaderProfileState(null);
    if (authTitle instanceof HTMLElement) {
      authTitle.textContent = 'Вход в аккаунт';
    }
    if (authCopy instanceof HTMLElement) {
      authCopy.textContent =
        'Войдите через Google, чтобы сохранять прогресс и возвращаться к обучению с любого устройства.';
    }
    if (authAvatar instanceof HTMLImageElement) {
      authAvatar.hidden = true;
      authAvatar.removeAttribute('src');
    }
    if (authAvatarFallback instanceof HTMLElement) {
      authAvatarFallback.hidden = false;
      authAvatarFallback.textContent = 'U';
    }
  };

  const renderSignedInUser = (profile) => {
    const normalizedProfile = normalizeProfile(profile);
    setElementHidden(authUserCard, false);
    setElementHidden(googleLoginBtn, true);
    setElementHidden(authSignoutBtn, false);
    renderHeaderProfileState(normalizedProfile);
    writeCachedProfile(normalizedProfile);
    if (authTitle instanceof HTMLElement) {
      authTitle.textContent = 'Ваш профиль';
    }
    if (authCopy instanceof HTMLElement) {
      authCopy.textContent = 'Аккаунт подключён. Здесь будет отображаться ваш общий профиль для сайта и приложения.';
    }
    if (authName instanceof HTMLElement) {
      authName.textContent = normalizedProfile.name || 'CodeJourney User';
    }
    if (authEmail instanceof HTMLElement) {
      authEmail.textContent = normalizedProfile.email || 'Без email';
    }
    if (authPlan instanceof HTMLElement) {
      authPlan.textContent = String(normalizedProfile.plan || 'free').toUpperCase();
    }

    const avatarText =
      (normalizedProfile.name || normalizedProfile.email || 'U').trim().charAt(0).toUpperCase() || 'U';
    if (authAvatarFallback instanceof HTMLElement) {
      authAvatarFallback.textContent = avatarText;
    }

    if (authAvatar instanceof HTMLImageElement) {
      if (normalizedProfile.photoUrl) {
        authAvatar.src = normalizedProfile.photoUrl;
        authAvatar.hidden = false;
        if (authAvatarFallback instanceof HTMLElement) {
          authAvatarFallback.hidden = true;
        }
      } else {
        authAvatar.hidden = true;
        authAvatar.removeAttribute('src');
        if (authAvatarFallback instanceof HTMLElement) {
          authAvatarFallback.hidden = false;
        }
      }
    }
  };

  const syncUserProfile = async (context, user) => {
    const userRef = context.doc(context.db, 'users', user.uid);
    const existingUser = await context.getDoc(userRef);

    const profilePayload = {
      name: user.displayName || user.email?.split('@')[0] || 'CodeJourney User',
      email: user.email || '',
      photoUrl: user.photoURL || '',
      updatedAt: context.serverTimestamp(),
    };

    if (!existingUser.exists()) {
      await context.setDoc(userRef, {
        ...profilePayload,
        plan: 'free',
        role: 'user',
        createdAt: context.serverTimestamp(),
      });
      return {
        ...profilePayload,
        plan: 'free',
        role: 'user',
      };
    }

    await context.setDoc(userRef, profilePayload, { merge: true });
    const existingData = existingUser.data();
    return {
      ...existingData,
      ...profilePayload,
      plan: existingData.plan || 'free',
      role: existingData.role || 'user',
    };
  };

  const ensureFirebaseAuth = async ({ showLoadError = false } = {}) => {
    try {
      const context = await getFirebaseContext();

      if (!authObserverInitialized) {
        context.onAuthStateChanged(context.auth, async (user) => {
          if (!user) {
            clearCachedProfile();
            resetAuthView();
            renderCommunitySignedOut();
            setAuthStatus('');
            return;
          }

          try {
            const profile = await syncUserProfile(context, user);
            renderSignedInUser(profile);
            loadCommunityData(context, user);
            setAuthStatus('');
          } catch (error) {
            console.error('User profile sync failed:', error);
            renderSignedInUser(buildProfileFromAuthUser(user));
            loadCommunityData(context, user);
            setAuthStatus('Вы вошли, но синхронизация профиля с Firestore временно недоступна.', 'error');
          }
        });
        authObserverInitialized = true;
      }

      return context;
    } catch (error) {
      console.error('Firebase auth setup failed:', error);
      if (showLoadError) {
        setAuthStatus(
          'Не удалось загрузить Firebase. Откройте сайт через localhost/https и проверьте интернет.',
          'error'
        );
      }
      return null;
    }
  };

  const closeModal = () => {
    if (!(activeModal instanceof HTMLElement)) return;

    activeModal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (activeModalTrigger instanceof HTMLElement) {
      activeModalTrigger.focus();
    }
    activeModal = null;
    activeModalTrigger = null;
  };

  const openModal = (modal, trigger) => {
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    activeModal = modal;
    activeModalTrigger = trigger;

    const focusTarget =
      modal.querySelector('.google-login-btn:not([hidden]), .auth-signout-btn:not([hidden])') ||
      modal.querySelector('.auth-modal__close');
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    }
  };

  modalTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();

      const modalId = trigger.getAttribute('data-modal-target');
      if (!modalId) return;

      const modal = document.getElementById(modalId);
      if (!(modal instanceof HTMLElement)) return;

      openModal(modal, trigger);
      setAuthStatus('Подключаем Firebase...', 'info');
      ensureFirebaseAuth({ showLoadError: true }).then((context) => {
        if (context) {
          setAuthStatus('');
        }
      });
    });
  });

  modalCloseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  if (authSignoutBtn instanceof HTMLButtonElement) {
    authSignoutBtn.addEventListener('click', async () => {
      const firebaseContext = await ensureFirebaseAuth({ showLoadError: true });
      if (!firebaseContext) return;

      try {
        await firebaseContext.signOut(firebaseContext.auth);
        clearCachedProfile();
        resetAuthView();
        renderCommunitySignedOut();
        setAuthStatus('Вы вышли из аккаунта.', 'info');
      } catch (error) {
        console.error('Sign-out failed:', error);
        setAuthStatus('Не удалось выйти из аккаунта.', 'error');
      }
    });
  }

  resetAuthView();
  const cachedProfile = readCachedProfile();
  if (cachedProfile) {
    renderHeaderProfileState(cachedProfile);
  }
  renderCommunitySignedOut();
  ensureFirebaseAuth({ showLoadError: false });

  if (communityRefreshBtn instanceof HTMLButtonElement) {
    communityRefreshBtn.addEventListener('click', async () => {
      const firebaseContext = await ensureFirebaseAuth({ showLoadError: true });
      if (!firebaseContext) return;
      await loadCommunityData(firebaseContext, firebaseContext.auth.currentUser);
    });
  }

  communityJumpButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.communityJump;
      if (!target) return;
      const card = document.querySelector(`[data-community-card="${target}"]`);
      if (!(card instanceof HTMLElement)) return;
      const top = card.getBoundingClientRect().top + window.scrollY - getAnchorOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  });

  if (googleLoginBtn instanceof HTMLAnchorElement) {
    googleLoginBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      setGoogleButtonBusy(true);
      setAuthStatus('Открываем окно входа Google...', 'info');

      const firebaseContext = await ensureFirebaseAuth({ showLoadError: true });
      if (!firebaseContext) {
        setGoogleButtonBusy(false);
        return;
      }

      try {
        const signInResult = await firebaseContext.signInWithPopup(
          firebaseContext.auth,
          firebaseContext.provider
        );
        const signedInUser = signInResult && signInResult.user ? signInResult.user : null;
        if (signedInUser) {
          try {
            const profile = await syncUserProfile(firebaseContext, signedInUser);
            renderSignedInUser(profile);
            loadCommunityData(firebaseContext, signedInUser);
            setAuthStatus('');
          } catch (profileError) {
            console.error('User profile sync failed right after sign-in:', profileError);
            renderSignedInUser(buildProfileFromAuthUser(signedInUser));
            loadCommunityData(firebaseContext, signedInUser);
            setAuthStatus('Вы вошли, но синхронизация профиля с Firestore временно недоступна.', 'error');
          }
        }
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error ? String(error.code) : '';

        if (code === 'auth/popup-closed-by-user') {
          setAuthStatus('Окно входа закрыто. Попробуйте ещё раз.', 'error');
        } else if (code === 'auth/popup-blocked') {
          setAuthStatus('Браузер заблокировал popup. Разрешите всплывающее окно и повторите.', 'error');
        } else if (code === 'auth/unauthorized-domain') {
          setAuthStatus('Этот домен не добавлен в Firebase Auth. Нужен Authorized domain.', 'error');
        } else if (code === 'auth/operation-not-supported-in-this-environment') {
          setAuthStatus('Откройте сайт через http://localhost или https, а не через file://.', 'error');
        } else {
          setAuthStatus('Не удалось войти через Google. Проверьте настройки Firebase Auth.', 'error');
        }

        console.error('Google sign-in failed:', error);
      } finally {
        setGoogleButtonBusy(false);
      }
    });
  }

  const courseButtons = Array.from(document.querySelectorAll('.course-nav-btn'));
  const coursePanels = Array.from(document.querySelectorAll('.course-detail'));
  const coursePlaceholder = document.querySelector('[data-course-placeholder]');

  const setActiveCourse = (courseId = null) => {
    courseButtons.forEach((button) => {
      const isActive = courseId !== null && button.dataset.courseTarget === courseId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    coursePanels.forEach((panel) => {
      const isActive = courseId !== null && panel.dataset.coursePanel === courseId;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });

    if (coursePlaceholder instanceof HTMLElement) {
      coursePlaceholder.hidden = courseId !== null;
    }
  };

  courseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const courseId = button.dataset.courseTarget;
      if (!courseId) return;
      setActiveCourse(courseId);
    });
  });
  setActiveCourse(null);

  const helloItems = Array.from(document.querySelectorAll('[data-hello-item]'));
  if (helloItems.length > 0) {
    let activeHelloIndex = Math.max(
      0,
      helloItems.findIndex((item) => item.classList.contains('is-active'))
    );

    const setActiveHelloItem = (nextIndex) => {
      helloItems.forEach((item, index) => {
        item.classList.toggle('is-active', index === nextIndex);
      });
      activeHelloIndex = nextIndex;
    };

    setActiveHelloItem(activeHelloIndex);
    window.setInterval(() => {
      const nextIndex = (activeHelloIndex + 1) % helloItems.length;
      setActiveHelloItem(nextIndex);
    }, 5000);
  }

  const toggles = Array.from(document.querySelectorAll('[data-toggle]'));
  const setToggleLabel = (button, list) => {
    button.textContent = list.hasAttribute('hidden')
      ? 'Смотреть программу'
      : 'Скрыть программу';
  };

  toggles.forEach((toggleBtn) => {
    const targetId = toggleBtn.getAttribute('data-toggle');
    if (targetId) {
      const list = document.getElementById(targetId);
      if (list) {
        setToggleLabel(toggleBtn, list);
      }
    }

    toggleBtn.addEventListener('click', () => {
      const currentTargetId = toggleBtn.getAttribute('data-toggle');
      if (!currentTargetId) return;

      const list = document.getElementById(currentTargetId);
      if (!list) return;

      const isHidden = list.hasAttribute('hidden');
      if (isHidden) {
        list.removeAttribute('hidden');
      } else {
        list.setAttribute('hidden', '');
      }
      setToggleLabel(toggleBtn, list);
    });
  });

  const checks = Array.from(document.querySelectorAll('.learning-check'));
  const checklistCount = document.getElementById('checklist-count');
  const checklistNextStep = document.getElementById('checklist-next-step');
  const checklistStorageKey = 'cj-learning-checks-v1';

  const updateChecklistCount = () => {
    const completed = checks.filter((item) => item.checked).length;
    if (checklistCount) {
      checklistCount.textContent = String(completed);
    }

    if (checklistNextStep) {
      if (completed >= checks.length && checks.length > 0) {
        checklistNextStep.textContent = 'Готово! Переходи к выбору курса ниже.';
      } else if (completed > 0) {
        checklistNextStep.textContent =
          'Хорошо идешь. Закрой оставшиеся пункты или сразу переходи к курсам ниже.';
      } else {
        checklistNextStep.textContent = 'Можно сразу переходить к выбору курса ниже.';
      }
    }
  };

  const saveChecklist = () => {
    const payload = {};
    checks.forEach((item) => {
      const key = item.dataset.key;
      if (!key) return;
      payload[key] = item.checked;
    });
    try {
      localStorage.setItem(checklistStorageKey, JSON.stringify(payload));
    } catch (_) {
      // ignore write errors (private mode/quota)
    }
  };

  if (checks.length > 0) {
    try {
      const raw = localStorage.getItem(checklistStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        checks.forEach((item) => {
          const key = item.dataset.key;
          if (!key) return;
          item.checked = Boolean(parsed[key]);
        });
      }
    } catch (_) {
      // ignore parse/read errors
    }

    checks.forEach((item) => {
      item.addEventListener('change', () => {
        updateChecklistCount();
        saveChecklist();
      });
    });
    updateChecklistCount();
  }

  const faqButtons = Array.from(document.querySelectorAll('.faq-q'));
  faqButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      if (!(answer instanceof HTMLElement)) return;

      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (expanded) {
        answer.setAttribute('hidden', '');
      } else {
        answer.removeAttribute('hidden');
      }
    });
  });

  const navLinks = Array.from(document.querySelectorAll('.bottom-nav a'));
  const navSections = navLinks
    .map((link) => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return null;
      const section = document.querySelector(href);
      if (!(section instanceof HTMLElement)) return null;
      return { href, section, link };
    })
    .filter(Boolean);

  const updateActiveNav = () => {
    if (navSections.length === 0) return;

    const viewportLine = window.scrollY + getAnchorOffset() + 4;
    let current = navSections[0];

    navSections.forEach((item) => {
      if (item.section.offsetTop <= viewportLine) {
        current = item;
      }
    });

    navSections.forEach((item) => {
      item.link.classList.toggle('active', item.href === current.href);
    });
  };

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  window.addEventListener('resize', updateActiveNav);
  updateActiveNav();

  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }
});
