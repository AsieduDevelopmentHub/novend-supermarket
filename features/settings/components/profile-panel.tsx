"use client";

import { FormEvent, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingState } from "@/components/feedback/loading-state";
import { VerifyEmailDialog } from "@/features/auth/components/verify-email-dialog";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCurrentUser } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { assertValidImageFile, IMAGE_ACCEPT } from "@/lib/uploads/image";
import { uploadAndClaimStorage } from "@/lib/uploads/convex-storage";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueUpdateProfile,
} from "@/lib/offline/replica-writes";
import { Camera, Trash2 } from "lucide-react";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function EmailAccountCard({
  email,
  emailVerified,
  online,
}: {
  email: string | null;
  emailVerified: boolean;
  online: boolean;
}) {
  const changeEmail = useAction(api.emailVerification.changeOwnEmail);
  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [autoRequest, setAutoRequest] = useState(true);
  const dirty = nextEmail.trim().toLowerCase() !== (email ?? "").trim().toLowerCase();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      toast.message("Reconnect to change your email");
      return;
    }
    if (!dirty) {
      setAutoRequest(true);
      setVerifyOpen(true);
      return;
    }
    setPending(true);
    try {
      await changeEmail({ email: nextEmail, currentPassword });
      setCurrentPassword("");
      setAutoRequest(false);
      setVerifyOpen(true);
      toast.success("We sent a verification code to your new email.");
    } catch (error) {
      showError(error, "Could not update your email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in email</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="profileEmail">Email</Label>
            <Input
              id="profileEmail"
              type="email"
              autoComplete="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              disabled={!online}
              required
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {emailVerified
                ? "Verified. Changing this updates how you sign in and needs a new verification code."
                : "Not verified yet. You can correct it here, then enter the code we send."}
            </p>
          </div>
          {dirty ? (
            <div className="space-y-2">
              <Label htmlFor="profileEmailPassword">Current password</Label>
              <PasswordInput
                id="profileEmailPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                disabled={!online}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <Button type="submit" disabled={pending || !online || !currentPassword}>
                {pending ? "Updating…" : "Update email"}
              </Button>
            ) : emailVerified ? null : (
              <Button type="submit" disabled={pending || !online}>
                Verify email
              </Button>
            )}
          </div>
        </form>
        <VerifyEmailDialog
          open={verifyOpen}
          onOpenChange={setVerifyOpen}
          autoRequest={autoRequest}
        />
      </CardContent>
    </Card>
  );
}

export function ProfilePanel() {
  const online = useConnectivity();
  const remote = useQuery(api.users.me, online ? {} : "skip");
  const { user: cachedUser, isLoading: cacheLoading } = useCurrentUser();

  const me =
    remote ??
    (cachedUser
      ? {
          userId: cachedUser.userId ?? "local",
          email: cachedUser.email ?? null,
          needsProfile: false as const,
          name: cachedUser.name,
          phone: cachedUser.phone ?? null,
          imageUrl: cachedUser.imageUrl ?? null,
        }
      : null);

  if ((online && remote === undefined) || (!online && cacheLoading && !me)) {
    return <LoadingState label="Loading profile…" variant="form" />;
  }

  if (!me || me.needsProfile) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-5 text-sm">
          Complete your profile setup before editing personal details.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid max-w-2xl gap-6">
      <ProfileForm
        key={`${me.userId}:${me.name}:${me.phone ?? ""}:${me.imageUrl ?? ""}`}
        initialName={me.name}
        initialPhone={me.phone ?? ""}
        imageUrl={me.imageUrl}
        online={online}
      />
      <EmailAccountCard
        key={me.email ?? "none"}
        email={me.email}
        emailVerified={remote?.emailVerified === true}
        online={online}
      />
    </div>
  );
}

function ProfileForm({
  initialName,
  initialPhone,
  imageUrl,
  online = true,
}: {
  initialName: string;
  initialPhone: string;
  imageUrl: string | null;
  online?: boolean;
}) {
  const updateOwnProfile = useMutation(api.users.updateOwnProfile);
  const generateUploadUrl = useMutation(api.users.generateProfileUploadUrl);
  const claimUpload = useMutation(api.storageUploads.claim);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pending, setPending] = useState(false);

  const displayUrl = removeImage ? null : (previewUrl ?? imageUrl);
  const initials = initialsFromName(name || initialName);

  function onPickFile(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setRemoveImage(false);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function onFileInputChange(fileList: FileList | null) {
    const next = fileList?.[0] ?? null;
    if (!next) {
      onPickFile(null);
      return;
    }
    try {
      await assertValidImageFile(next);
      onPickFile(next);
    } catch (error) {
      showError(error, "Invalid image file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onPickFile(null);
    }
  }

  async function uploadImage(): Promise<Id<"_storage"> | undefined> {
    if (!file) return undefined;
    await assertValidImageFile(file);
    return await uploadAndClaimStorage({
      begin: () => generateUploadUrl({}),
      claim: (args) => claimUpload(args),
      body: file,
      contentType: file.type || "image/jpeg",
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!online && (file || removeImage)) {
      toast.error(
        "Photo updates need a connection. Your name and phone can still be saved on this device.",
      );
    }
    setPending(true);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: async () => {
          const imageStorageId = await uploadImage();
          await updateOwnProfile({
            name: name.trim(),
            phone: phone.trim() || undefined,
            imageStorageId,
            clearImage: removeImage || undefined,
          });
        },
        local: () => queueUpdateProfile({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      toast.success(queuedSaveMessage(kind, "Profile saved"));
      setFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setRemoveImage(false);
    } catch (error) {
      showError(error, "Could not save profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 border">
              {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <p className="text-sm font-medium">Profile picture</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!online}
                  title={!online ? "Photo updates need a connection" : undefined}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {displayUrl ? "Change photo" : "Upload photo"}
                </Button>
                {displayUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!online}
                    title={!online ? "Photo updates need a connection" : undefined}
                    onClick={() => {
                      onPickFile(null);
                      setRemoveImage(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => void onFileInputChange(e.target.files)}
              />
              <p className="text-muted-foreground text-xs">
                JPG/JPEG, PNG, or WebP · max 2 MB. Shown in the sidebar and user lists.
                {!online ? " Photo changes need a connection." : ""}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profileName">Full name</Label>
            <Input
              id="profileName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profilePhone">Phone</Label>
            <Input
              id="profilePhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 024 XXX XXXX"
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : online ? "Save profile" : "Save on this device"}
          </Button>
          {!online ? (
            <p className="text-muted-foreground text-sm">
              Name and phone save on this device and sync when you reconnect. Password, email, and
              photo changes need a connection.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
