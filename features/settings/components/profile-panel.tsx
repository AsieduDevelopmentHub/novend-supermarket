"use client";

import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingState } from "@/components/feedback/loading-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useCurrentUser } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { assertValidImageFile, IMAGE_ACCEPT } from "@/lib/uploads/image";
import { Camera, Trash2 } from "lucide-react";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    <ProfileForm
      key={`${me.userId}:${me.name}:${me.phone ?? ""}:${me.imageUrl ?? ""}`}
      email={me.email}
      initialName={me.name}
      initialPhone={me.phone ?? ""}
      imageUrl={me.imageUrl}
      readOnly={!online}
    />
  );
}

function ProfileForm({
  email,
  initialName,
  initialPhone,
  imageUrl,
  readOnly = false,
}: {
  email: string | null;
  initialName: string;
  initialPhone: string;
  imageUrl: string | null;
  readOnly?: boolean;
}) {
  const updateOwnProfile = useMutation(api.users.updateOwnProfile);
  const generateUploadUrl = useMutation(api.users.generateProfileUploadUrl);
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
    const uploadUrl = await generateUploadUrl({});
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (!result.ok) throw new Error("Image upload failed");
    const json = (await result.json()) as { storageId: Id<"_storage"> };
    return json.storageId;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) {
      toast.message("Reconnect to update your profile");
      return;
    }
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setPending(true);
    try {
      const imageStorageId = await uploadImage();
      await updateOwnProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        imageStorageId,
        clearImage: removeImage || undefined,
      });
      toast.success("Profile saved");
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
                  disabled={readOnly}
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
                    disabled={readOnly}
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
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profileEmail">Email</Label>
            <Input id="profileEmail" value={email ?? ""} disabled />
            <p className="text-muted-foreground text-xs">
              Email is set when your account is created. Ask an administrator to change it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profilePhone">Phone</Label>
            <Input
              id="profilePhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 024 XXX XXXX"
              disabled={readOnly}
            />
          </div>

          <Button type="submit" disabled={pending || readOnly}>
            {readOnly ? "Read-only offline" : pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
