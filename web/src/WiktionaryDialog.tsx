/* eslint-disable @remotion/warn-native-media-tag -- Browser editor dialog, not a rendered video composition. */
import { useEffect, useRef, useState } from "react";
import { resolveWiktionary, wiktionaryUrl } from "./wiktionary";

export function WiktionaryDialog({
  term,
  onClose,
}: {
  term: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let active = true;
    void resolveWiktionary(term).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [term]);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="dictionary-dialog"
      aria-labelledby="dictionary-title"
    >
      <div className="sectionhead">
        <h2 id="dictionary-title">Wiktionary · {term}</h2>
        <button autoFocus onClick={onClose}>
          Close
        </button>
      </div>
      <div className="dictionary-body" aria-busy={!loaded}>
        {!loaded && (
          <p className="dictionary-loading" role="status">
            Loading Wiktionary…
          </p>
        )}
        {url && (
          <iframe
            title={`Wiktionary entry: ${term}`}
            src={url}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      <footer>
        <a href={url ?? wiktionaryUrl(term)} target="_blank" rel="noreferrer">
          Open page separately ↗
        </a>
      </footer>
    </dialog>
  );
}
