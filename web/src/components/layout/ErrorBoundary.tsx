import {Component, type ReactNode} from 'react';
import {withTranslation, type WithTranslation} from 'react-i18next';

/**
 * Last line of defence against a render-time throw.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, which in an app
 * with no boundary means a blank white page — no navigation, no explanation, no way back
 * except a manual URL edit. That is a poor outcome anywhere; on the evidence route it is the
 * difference between a worker showing an official a wage-arrears record and showing them
 * nothing at all.
 *
 * Deliberately a plain component, not a wrapper around some reporting SDK: it renders a way
 * out (reload, and a link home) and logs the error to the console for a developer to find.
 *
 * A class because `componentDidCatch`/`getDerivedStateFromError` have no hook equivalent —
 * this is the one place React still requires one.
 */
class ErrorBoundaryInner extends Component<WithTranslation & {children: ReactNode}, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() {
    return {failed: true};
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[imgeum] unhandled render error', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const {t} = this.props;

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-4">
        <div className="max-w-md rounded border-2 border-vermil/40 bg-ink-2 p-8 text-center">
          <p className="font-display text-3xl font-black text-vermil">✕</p>
          <h1 className="mt-3 font-display text-xl font-bold text-hanji">{t('common:error.title')}</h1>
          <p className="mt-2 text-sm text-hanji/60">{t('common:error.body')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border-2 border-cheong px-4 py-2 text-sm font-semibold text-jade-mist hover:bg-cheong/10"
            >
              {t('common:error.reload')}
            </button>
            <a
              href="/"
              className="rounded border-2 border-hanji/25 px-4 py-2 text-sm font-semibold text-hanji/70 hover:bg-hanji/5"
            >
              {t('common:error.home')}
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
