document.documentElement.classList.add('js-ready');

const firebaseConfig = {
  apiKey: 'AIzaSyAIOhQThmPnSl-YcfXqLlVm-Q66Dp_ES4c',
  authDomain: 'codejourney-app.firebaseapp.com',
  projectId: 'codejourney-app',
  storageBucket: 'codejourney-app.firebasestorage.app',
  messagingSenderId: '30574550222',
  appId: '1:30574550222:web:b32e2e7893932ec55c449f',
  measurementId: 'G-HJFMHNYGXV',
};

let firebaseContextPromise = null;

const getFirebaseContext = async () => {
  if (!firebaseContextPromise) {
    firebaseContextPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js'),
    ]).then(([appModule, authModule, firestoreModule]) => {
      const firebaseApp = appModule.initializeApp(firebaseConfig);
      const auth = authModule.getAuth(firebaseApp);
      const db = firestoreModule.getFirestore(firebaseApp);
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      return {
        auth,
        db,
        provider,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        onAuthStateChanged: authModule.onAuthStateChanged,
        serverTimestamp: firestoreModule.serverTimestamp,
        setDoc: firestoreModule.setDoc,
        signInWithPopup: authModule.signInWithPopup,
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
      if (link.dataset.modalTarget) return;

      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      event.preventDefault();
      scrollToAnchor(href);
      history.replaceState(null, '', href);
    });
  });

  if (window.location.hash) {
    window.requestAnimationFrame(() => {
      scrollToAnchor(window.location.hash, 'auto');
    });
  }

  const modalTriggers = Array.from(document.querySelectorAll('[data-modal-target]'));
  const modalCloseButtons = Array.from(document.querySelectorAll('[data-modal-close]'));
  const authStatus = document.querySelector('[data-auth-status]');
  const googleLoginBtn = document.querySelector('.google-login-btn');
  let activeModal = null;
  let activeModalTrigger = null;
  let authObserverInitialized = false;

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
      return;
    }

    await context.setDoc(userRef, profilePayload, { merge: true });
  };

  const ensureFirebaseAuth = async ({ showLoadError = false } = {}) => {
    try {
      const context = await getFirebaseContext();

      if (!authObserverInitialized) {
        context.onAuthStateChanged(context.auth, async (user) => {
          if (!user) {
            setAuthStatus('');
            return;
          }

          try {
            await syncUserProfile(context, user);
            const identity = user.displayName || user.email || 'Google аккаунт';
            setAuthStatus(`Вы вошли как ${identity}.`, 'success');
          } catch (error) {
            console.error('User profile sync failed:', error);
            setAuthStatus('Вход выполнен, но профиль не сохранился в Firestore.', 'error');
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

    const focusTarget = modal.querySelector('.google-login-btn, [data-modal-close]');
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
        if (context && !(authStatus instanceof HTMLElement && authStatus.dataset.state === 'success')) {
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
        await firebaseContext.signInWithPopup(firebaseContext.auth, firebaseContext.provider);
        closeModal();
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
  const checklistStorageKey = 'cj-learning-checks-v1';

  const updateChecklistCount = () => {
    const completed = checks.filter((item) => item.checked).length;
    if (checklistCount) {
      checklistCount.textContent = String(completed);
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
