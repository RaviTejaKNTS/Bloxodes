"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MessageCircle, Pencil, Reply, Send, Trash2 } from "lucide-react";
import { FiCompass, FiCoffee, FiFeather, FiStar, FiUser, FiZap } from "react-icons/fi";
import type { CommentEntry } from "@/lib/comments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CommentsClientProps = {
  entityType: "code" | "article" | "catalog" | "event" | "tool" | "wiki" | "wiki_collection";
  entityId: string;
  initialComments: CommentEntry[];
};

type SessionUser = {
  id: string;
  display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_display_name: string | null;
  roblox_username: string | null;
  role: "admin" | "user" | null;
};

type SessionState = {
  status: "loading" | "ready";
  user: SessionUser | null;
};

type CommentNode = CommentEntry & { replies: CommentNode[] };

const MAX_BODY_LENGTH = 1000;
const MAX_GUEST_NAME_LENGTH = 60;
const MAX_GUEST_EMAIL_LENGTH = 120;
const FALLBACK_ICONS = [FiUser, FiZap, FiStar, FiCompass, FiCoffee, FiFeather];
const FALLBACK_COLORS = [
  "border-border/70 bg-muted/20 text-muted-foreground",
  "border-border/70 bg-muted/20 text-muted-foreground",
  "border-border/70 bg-muted/20 text-muted-foreground",
  "border-border/70 bg-muted/20 text-muted-foreground",
  "border-border/70 bg-muted/20 text-muted-foreground",
  "border-border/70 bg-muted/20 text-muted-foreground"
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function displayName(author: CommentEntry["author"]): string {
  return (
    author.display_name ||
    author.roblox_display_name ||
    (author.roblox_username ? `@${author.roblox_username}` : null) ||
    "Player"
  );
}

function buildTree(comments: CommentEntry[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  comments.forEach((comment) => {
    nodes.set(comment.id, { ...comment, replies: [] });
  });

  const roots: CommentNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_id) {
      const parent = nodes.get(node.parent_id);
      if (parent) {
        parent.replies.push(node);
      }
      return;
    }
    if (!node.parent_id) {
      roots.push(node);
    }
  });

  const sortReplies = (items: CommentNode[]) => {
    items.sort((a, b) => a.created_at.localeCompare(b.created_at));
    items.forEach((item) => sortReplies(item.replies));
  };

  roots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  roots.forEach((item) => sortReplies(item.replies));
  return roots;
}

function updateCommentState(
  comments: CommentEntry[],
  id: string,
  updater: (comment: CommentEntry) => CommentEntry
) {
  return comments.map((comment) => (comment.id === id ? updater(comment) : comment));
}

function removeCommentAndReplies(comments: CommentEntry[], id: string) {
  const childrenMap = new Map<string, string[]>();
  comments.forEach((comment) => {
    if (!comment.parent_id) return;
    const existing = childrenMap.get(comment.parent_id) ?? [];
    existing.push(comment.id);
    childrenMap.set(comment.parent_id, existing);
  });

  const toRemove = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    if (!current || toRemove.has(current)) continue;
    toRemove.add(current);
    const children = childrenMap.get(current) ?? [];
    children.forEach((child) => stack.push(child));
  }

  return comments.filter((comment) => !toRemove.has(comment.id));
}

function CommentAvatar({ author }: { author: CommentEntry["author"] }) {
  if (author.roblox_avatar_url) {
    return (
      <Image
        src={author.roblox_avatar_url}
        alt={`${displayName(author)} avatar`}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full border border-border/60 object-cover"
      />
    );
  }

  const seed = author.id || "fallback";
  const hash = hashString(seed);
  const Icon = FALLBACK_ICONS[hash % FALLBACK_ICONS.length] ?? FiUser;
  const colorClass = FALLBACK_COLORS[hash % FALLBACK_COLORS.length] ?? FALLBACK_COLORS[0];

  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${colorClass}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  );
}

export function CommentsClient({ entityType, entityId, initialComments }: CommentsClientProps) {
  const [loginHref, setLoginHref] = useState("/login");
  const [comments, setComments] = useState<CommentEntry[]>(initialComments);
  const [session, setSession] = useState<SessionState>({ status: "loading", user: null });
  const [newBody, setNewBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextPath = `${window.location.pathname}${window.location.search}`;
    const nextParam = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    setLoginHref(`/login${nextParam}`);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/comments/session");
        const payload = await res.json();
        if (!isActive) return;
        setSession({ status: "ready", user: payload?.user ?? null });
      } catch {
        if (!isActive) return;
        setSession({ status: "ready", user: null });
      }
    };

    loadSession();
    return () => {
      isActive = false;
    };
  }, []);

  const commentTree = useMemo(() => buildTree(comments), [comments]);
  const commentCount = comments.length;
  const guestNameTrimmed = guestName.trim();
  const guestEmailTrimmed = guestEmail.trim();
  const guestNameValid =
    guestNameTrimmed.length >= 2 && guestNameTrimmed.length <= MAX_GUEST_NAME_LENGTH;
  const guestEmailValid =
    guestEmailTrimmed.length > 5 &&
    guestEmailTrimmed.length <= MAX_GUEST_EMAIL_LENGTH &&
    guestEmailTrimmed.includes("@") &&
    guestEmailTrimmed.split("@")[1]?.includes(".");
  const isAuthenticated = Boolean(session.user);
  const guestInfoValid = guestNameValid && guestEmailValid;
  const canSubmit = !isSubmitting && (isAuthenticated || guestInfoValid);

  function resetReplyForm() {
    setActiveReplyId(null);
    setReplyBody("");
    setReplyError(null);
  }

  function resetEditForm() {
    setEditingId(null);
    setEditBody("");
    setEditError(null);
  }

  async function submitComment({
    body,
    parentId,
    onRestoreBody,
    onSuccess,
    setError
  }: {
    body: string;
    parentId: string | null;
    onRestoreBody: (value: string) => void;
    onSuccess: () => void;
    setError: (value: string | null) => void;
  }) {
    setError(null);

    if (!session.user) {
      if (!guestNameValid) {
        setError("Please enter your name to comment.");
        return;
      }
      if (!guestEmailValid) {
        setError("Please enter a valid email address to comment.");
        return;
      }
    }

    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write a comment before submitting.");
      return;
    }

    if (trimmed.length > MAX_BODY_LENGTH) {
      setError(`Comments must be ${MAX_BODY_LENGTH} characters or less.`);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const author = session.user
      ? {
          id: session.user.id,
          display_name: session.user.display_name,
          roblox_avatar_url: session.user.roblox_avatar_url,
          roblox_display_name: session.user.roblox_display_name,
          roblox_username: session.user.roblox_username,
          role: session.user.role
        }
      : {
          id: `guest:${tempId}`,
          display_name: guestNameTrimmed,
          roblox_avatar_url: null,
          roblox_display_name: null,
          roblox_username: null,
          role: null
        };
    const optimistic: CommentEntry = {
      id: tempId,
      parent_id: parentId,
      body_md: trimmed,
      body_html: plainTextToHtml(trimmed),
      status: "pending",
      created_at: new Date().toISOString(),
      created_label: "Just now",
      author
    };

    setComments((prev) => [...prev, optimistic]);
    onSuccess();
    setIsSubmitting(true);

    try {
      const requestPayload: Record<string, string | null> = {
        entityType,
        entityId,
        parentId,
        body: trimmed
      };
      if (!session.user) {
        requestPayload.guestName = guestNameTrimmed;
        requestPayload.guestEmail = guestEmailTrimmed;
      }

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to submit comment.");
      }
      const comment = payload?.comment as CommentEntry | undefined;
      if (!comment) {
        throw new Error("Comment submission failed.");
      }
      setComments((prev) => prev.map((item) => (item.id === tempId ? comment : item)));
    } catch (submitError) {
      setComments((prev) => prev.filter((item) => item.id !== tempId));
      onRestoreBody(trimmed);
      setError(submitError instanceof Error ? submitError.message : "Unable to submit comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitComment({
      body: newBody,
      parentId: null,
      onRestoreBody: setNewBody,
      onSuccess: () => setNewBody(""),
      setError: setNewError
    });
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeReplyId) return;
    await submitComment({
      body: replyBody,
      parentId: activeReplyId,
      onRestoreBody: setReplyBody,
      onSuccess: resetReplyForm,
      setError: setReplyError
    });
  }

  function handleReplyOpen(commentId: string) {
    setActiveReplyId(commentId);
    setReplyBody("");
    setReplyError(null);
  }

  function handleEditOpen(comment: CommentEntry) {
    setEditingId(comment.id);
    setEditBody(comment.body_md);
    setEditError(null);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    setEditError(null);
    setActionError(null);

    if (!session.user) {
      setEditError("Please sign in to edit.");
      return;
    }

    const trimmed = editBody.trim();
    if (!trimmed) {
      setEditError("Write a comment before saving.");
      return;
    }

    if (trimmed.length > MAX_BODY_LENGTH) {
      setEditError(`Comments must be ${MAX_BODY_LENGTH} characters or less.`);
      return;
    }

    const original = comments.find((comment) => comment.id === editingId);
    if (!original) {
      setEditError("Comment not found.");
      return;
    }

    setComments((prev) =>
      updateCommentState(prev, editingId, (comment) => ({
        ...comment,
        body_md: trimmed,
        body_html: plainTextToHtml(trimmed),
        status: "pending"
      }))
    );
    setIsSubmitting(true);
    resetEditForm();

    try {
      const res = await fetch(`/api/comments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error ?? "Unable to update comment.");
      }
      const updated = payload?.comment as CommentEntry | undefined;
      if (!updated) {
        throw new Error("Comment update failed.");
      }
      setComments((prev) => updateCommentState(prev, updated.id, () => updated));
    } catch (submitError) {
      setComments((prev) => updateCommentState(prev, original.id, () => original));
      setActionError(submitError instanceof Error ? submitError.message : "Unable to update comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(comment: CommentEntry) {
    setActionError(null);
    if (!session.user) {
      setActionError("Please sign in to delete.");
      return;
    }

    const confirmed = window.confirm("Delete this comment and all of its replies?");
    if (!confirmed) return;

    const previous = comments;
    setComments((prev) => removeCommentAndReplies(prev, comment.id));
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to delete comment.");
      }
    } catch (deleteError) {
      setComments(previous);
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="overflow-hidden rounded-lg border-border/70 bg-card shadow-none" id="comments">
      <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-border/70 bg-muted/20 text-muted-foreground">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-xl leading-tight text-foreground sm:text-2xl">Comments</CardTitle>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-1 text-xs">
            {commentCount} total
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-3 sm:p-4">
        <div className="space-y-4 rounded-md border border-border/60 bg-muted/10 p-4">
          {session.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Checking your account...</p>
          ) : session.user ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CommentAvatar
                author={{
                  id: session.user.id,
                  display_name: session.user.display_name,
                  roblox_avatar_url: session.user.roblox_avatar_url,
                  roblox_display_name: session.user.roblox_display_name,
                  roblox_username: session.user.roblox_username,
                  role: session.user.role
                }}
              />
              <div>
                <p className="text-foreground">
                  Signed in as <span className="font-semibold">{session.user.display_name ?? "Bloxodes player"}</span>
                </p>
                <p className="text-xs text-muted-foreground">Comments are moderated before appearing publicly.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>Comment as a guest or sign in to use your account.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href={loginHref}>Log in</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll show your name publicly. Your email stays private and is used for moderation and requests about your comment.
                Comment text is automatically screened before publication. Read our{" "}
                <Link href="/privacy-policy" className="text-foreground underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          )}

          <form onSubmit={handleNewSubmit} className="space-y-3">
            {!session.user ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="guest-name"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Name
                  </label>
                  <Input
                    id="guest-name"
                    name="guest-name"
                    type="text"
                    autoComplete="name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    maxLength={MAX_GUEST_NAME_LENGTH}
                    placeholder="Your name"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="guest-email"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Email
                  </label>
                  <Input
                    id="guest-email"
                    name="guest-email"
                    type="email"
                    autoComplete="email"
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                    maxLength={MAX_GUEST_EMAIL_LENGTH}
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            ) : null}
            <Textarea
              name="body"
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
              rows={4}
              maxLength={MAX_BODY_LENGTH}
              placeholder={session.user ? "Write a comment..." : "Write a comment as a guest..."}
              disabled={isSubmitting}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{newBody.length}/{MAX_BODY_LENGTH}</span>
              <Button
                type="submit"
                disabled={!canSubmit}
                size="sm"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {isSubmitting ? "Posting..." : "Post comment"}
              </Button>
            </div>
            {newError ? <p className="text-sm text-red-400">{newError}</p> : null}
          </form>
        </div>

        {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

        {commentTree.length ? (
          <div className="space-y-4">
            {commentTree.map((comment) => (
              <CommentThread
                key={comment.id}
                node={comment}
                activeReplyId={activeReplyId}
                replyBody={replyBody}
                replyError={replyError}
                isSubmitting={isSubmitting}
                sessionUser={session.user}
                isAuthenticated={isAuthenticated}
                guestInfoValid={guestInfoValid}
                editingId={editingId}
                editBody={editBody}
                editError={editError}
                loginHref={loginHref}
                onReplyOpen={handleReplyOpen}
                onReplyCancel={resetReplyForm}
                onReplyBodyChange={setReplyBody}
                onReplySubmit={handleReplySubmit}
                onEditOpen={handleEditOpen}
                onEditCancel={resetEditForm}
                onEditBodyChange={setEditBody}
                onEditSubmit={handleEditSubmit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            No comments yet. Be the first to share a tip.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentThread({
  node,
  activeReplyId,
  replyBody,
  replyError,
  isSubmitting,
  sessionUser,
  isAuthenticated,
  guestInfoValid,
  editingId,
  editBody,
  editError,
  loginHref,
  onReplyOpen,
  onReplyCancel,
  onReplyBodyChange,
  onReplySubmit,
  onEditOpen,
  onEditCancel,
  onEditBodyChange,
  onEditSubmit,
  onDelete
}: {
  node: CommentNode;
  activeReplyId: string | null;
  replyBody: string;
  replyError: string | null;
  isSubmitting: boolean;
  sessionUser: SessionUser | null;
  isAuthenticated: boolean;
  guestInfoValid: boolean;
  editingId: string | null;
  editBody: string;
  editError: string | null;
  loginHref: string;
  onReplyOpen: (commentId: string) => void;
  onReplyCancel: () => void;
  onReplyBodyChange: (value: string) => void;
  onReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditOpen: (comment: CommentEntry) => void;
  onEditCancel: () => void;
  onEditBodyChange: (value: string) => void;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (comment: CommentEntry) => void;
}) {
  const name = displayName(node.author);
  const isAdmin = node.author.role === "admin";
  const isPending = node.status !== "approved";
  const isReplyActive = node.id === activeReplyId;
  const isEditing = node.id === editingId;
  const canManage = sessionUser?.id === node.author.id;
  const canReply = !isSubmitting && (isAuthenticated || guestInfoValid);

  return (
    <div className="space-y-4 rounded-md border border-border/60 bg-card px-4 py-4">
      <div className="flex items-start gap-3">
        <CommentAvatar author={node.author} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            {isAdmin ? (
              <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] text-amber-300">
                Admin
              </Badge>
            ) : null}
            {isPending ? (
              <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
                Pending
              </Badge>
            ) : null}
            {node.created_label ? <span>{node.created_label}</span> : null}
          </div>
          {isEditing ? (
            <form onSubmit={onEditSubmit} className="space-y-3">
              <Textarea
                name="edit"
                value={editBody}
                onChange={(event) => onEditBodyChange(event.target.value)}
                rows={4}
                maxLength={MAX_BODY_LENGTH}
                placeholder="Edit your comment..."
                disabled={!sessionUser || isSubmitting}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{editBody.length}/{MAX_BODY_LENGTH}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onEditCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!sessionUser || isSubmitting}
                    size="sm"
                  >
                    {isSubmitting ? "Saving..." : "Save edit"}
                  </Button>
                </div>
              </div>
              {editError ? <p className="text-sm text-red-400">{editError}</p> : null}
            </form>
          ) : (
            <div
              className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: node.body_html }}
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {isAuthenticated ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onReplyOpen(node.id)}
              >
                <Reply className="h-3.5 w-3.5" aria-hidden />
                Reply
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onReplyOpen(node.id)}
                >
                  <Reply className="h-3.5 w-3.5" aria-hidden />
                  Reply as guest
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={loginHref}>Log in</Link>
                </Button>
              </>
            )}
            {canManage ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditOpen(node)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(node)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </Button>
              </>
            ) : null}
          </div>
          {isReplyActive ? (
            <form onSubmit={onReplySubmit} className="space-y-3 pt-2">
              <Textarea
                name="reply"
                value={replyBody}
                onChange={(event) => onReplyBodyChange(event.target.value)}
                rows={3}
                maxLength={MAX_BODY_LENGTH}
                placeholder="Write a reply..."
                disabled={isSubmitting}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{replyBody.length}/{MAX_BODY_LENGTH}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onReplyCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canReply}
                    size="sm"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {isSubmitting ? "Posting..." : "Post reply"}
                  </Button>
                </div>
              </div>
              {!isAuthenticated && !guestInfoValid ? (
                <p className="text-xs text-muted-foreground">Add your name and email above to reply as a guest.</p>
              ) : null}
              {replyError ? <p className="text-sm text-red-400">{replyError}</p> : null}
            </form>
          ) : null}
        </div>
      </div>
      {node.status === "approved" && node.replies.length ? (
        <div className="space-y-3 border-l border-border/60 pl-4">
          {node.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              node={reply}
              activeReplyId={activeReplyId}
              replyBody={replyBody}
              replyError={replyError}
              isSubmitting={isSubmitting}
              sessionUser={sessionUser}
              isAuthenticated={isAuthenticated}
              guestInfoValid={guestInfoValid}
              editingId={editingId}
              editBody={editBody}
              editError={editError}
              loginHref={loginHref}
              onReplyOpen={onReplyOpen}
              onReplyCancel={onReplyCancel}
              onReplyBodyChange={onReplyBodyChange}
              onReplySubmit={onReplySubmit}
              onEditOpen={onEditOpen}
              onEditCancel={onEditCancel}
              onEditBodyChange={onEditBodyChange}
              onEditSubmit={onEditSubmit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
