"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { isTtsPackageId, TTS_PACKAGES, type TtsPackageId } from "@/lib/quotas";

type Quota = {
  package_id: TtsPackageId;
  quota_limit: number;
  characters_used: number;
  characters_reserved: number;
};

type Account = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  quota: Quota | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<Record<string, TtsPackageId>>({});
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadUsers(page: number, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users?page=${page}`, {
        cache: "no-store",
      });
      const data = await readJson<{ users: Account[]; hasMore: boolean }>(response);
      setAccounts((current) => append ? [...current, ...data.users] : data.users);
      setHasMore(data.hasMore);
      setPackageDrafts((current) => {
        const next = { ...current };
        for (const account of data.users) {
          if (!next[account.id]) {
            next[account.id] = account.quota?.package_id ?? "starter";
          }
        }
        return next;
      });
      setQuotaDrafts((current) => {
        const next = { ...current };
        for (const account of data.users) {
          if (next[account.id] === undefined) {
            next[account.id] = String(
              account.quota?.quota_limit ??
                TTS_PACKAGES[account.quota?.package_id ?? "starter"].characters,
            );
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load accounts.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadUsers(1);
    });
    return () => {
      active = false;
    };
  }, []);

  async function saveAccount(account: Account) {
    const packageId = packageDrafts[account.id];
    const quotaLimit = Number(quotaDrafts[account.id]);
    if (!isTtsPackageId(packageId) || !Number.isSafeInteger(quotaLimit)) {
      setError("Enter a whole-number quota and choose a package.");
      return;
    }
    setSavingId(account.id);
    setError("");
    setNotice("");
    try {
      await readJson(
        await fetch(`/api/admin/users/${encodeURIComponent(account.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId, quotaLimit }),
        }),
      );
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? {
                ...item,
                quota: {
                  package_id: packageId,
                  quota_limit: quotaLimit,
                  characters_used: item.quota?.characters_used ?? 0,
                  characters_reserved: item.quota?.characters_reserved ?? 0,
                },
              }
            : item,
        ),
      );
      setNotice(`Package and quota saved for ${account.email}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this account.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="admin-back" href="/">
          <ArrowLeft size={16} /> Workspace
        </Link>
        <span className="admin-brand"><ShieldCheck size={18} /> Admin</span>
      </header>
      <section className="admin-content">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">ACCOUNT MANAGEMENT</div>
            <h1>Packages &amp; quotas</h1>
            <p>Assign a plan and set the lifetime voice-character allowance for each account.</p>
          </div>
          <button className="secondary" onClick={() => void loadUsers(1)} disabled={loading}>
            {loading ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            Refresh
          </button>
        </div>

        <div className="package-cards">
          {Object.entries(TTS_PACKAGES).map(([id, plan]) => (
            <article className="package-card" key={id}>
              <span>{plan.name}</span>
              <strong>{plan.characters.toLocaleString()}</strong>
              <small>voice characters · no automatic reset</small>
            </article>
          ))}
        </div>

        {error && <div className="config-error admin-message" role="alert">{error}</div>}
        {notice && <div className="config-success admin-message" role="status">{notice}</div>}

        <section className="panel admin-table-panel">
          <div className="admin-table-title">
            <div><Users size={17} /> Registered accounts <span>{accounts.length}</span></div>
          </div>
          {loading ? (
            <div className="admin-loading"><Loader2 className="spin" size={20} /> Loading accounts…</div>
          ) : accounts.length ? (
            <>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Account</th><th>Package</th><th>Total characters</th>
                      <th>Used</th><th>Reserved</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <strong>{account.name || "—"}</strong>
                          <small>{account.email}</small>
                          <small>Joined {new Date(account.createdAt).toLocaleDateString()}</small>
                        </td>
                        <td>
                          <select
                            className="text-input admin-select"
                            value={packageDrafts[account.id] ?? "starter"}
                            onChange={(event) => {
                              const nextPackage = event.target.value;
                              if (!isTtsPackageId(nextPackage)) return;
                              setPackageDrafts((current) => ({ ...current, [account.id]: nextPackage }));
                              setQuotaDrafts((current) => ({
                                ...current,
                                [account.id]: String(TTS_PACKAGES[nextPackage].characters),
                              }));
                            }}
                          >
                            {Object.entries(TTS_PACKAGES).map(([id, plan]) => (
                              <option key={id} value={id}>{plan.name}</option>
                            ))}
                          </select>
                          {!account.quota && <small className="unassigned-label">Not assigned</small>}
                        </td>
                        <td>
                          <input
                            className="text-input admin-quota-input"
                            type="number"
                            min={0}
                            max={100_000_000}
                            step={1}
                            value={quotaDrafts[account.id] ?? ""}
                            onChange={(event) => setQuotaDrafts((current) => ({
                              ...current,
                              [account.id]: event.target.value,
                            }))}
                            aria-label={`Total character quota for ${account.email}`}
                          />
                        </td>
                        <td>{(account.quota?.characters_used ?? 0).toLocaleString()}</td>
                        <td>{(account.quota?.characters_reserved ?? 0).toLocaleString()}</td>
                        <td>
                          <button
                            className="primary admin-save"
                            onClick={() => void saveAccount(account)}
                            disabled={savingId === account.id}
                          >
                            {savingId === account.id ? <Loader2 className="spin" size={14} /> : "Save"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <button
                  className="secondary admin-load-more"
                  disabled={loadingMore}
                  onClick={() => void loadUsers(Math.floor(accounts.length / 50) + 1, true)}
                >
                  {loadingMore ? "Loading…" : "Load more accounts"}
                </button>
              )}
            </>
          ) : (
            <div className="admin-loading">No accounts found.</div>
          )}
        </section>
      </section>
    </main>
  );
}
