"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle, Link2Off, Loader2, ExternalLink } from "lucide-react";

const PLATFORMS = [
  {
    id: "EBAY",
    name: "eBay",
    description: "Sell to millions of buyers worldwide",
    logo: "🛒",
    authType: "oauth",
    color: "border-yellow-200 bg-yellow-50",
  },
  {
    id: "ETSY",
    name: "Etsy",
    description: "Reach buyers looking for unique items",
    logo: "🎨",
    authType: "oauth",
    color: "border-orange-200 bg-orange-50",
  },
  {
    id: "FACEBOOK",
    name: "Facebook Marketplace",
    description: "Sell locally and nationally on Facebook",
    logo: "📘",
    authType: "credentials",
    color: "border-blue-200 bg-blue-50",
  },
  {
    id: "CRAIGSLIST",
    name: "Craigslist",
    description: "Free local classifieds",
    logo: "📋",
    authType: "credentials",
    fields: [
      { name: "email", label: "Email", type: "email" },
      { name: "password", label: "Password", type: "password" },
      {
        name: "area",
        label: "Area Code",
        type: "text",
        placeholder: "e.g. sfbay, newyork",
      },
    ],
    color: "border-purple-200 bg-purple-50",
  },
  {
    id: "OFFERUP",
    name: "OfferUp",
    description: "Mobile-first marketplace for local deals",
    logo: "🏷️",
    authType: "credentials",
    color: "border-green-200 bg-green-50",
  },
];

interface PlatformConnection {
  platform: string;
}

export default function PlatformsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();

    // Show success/error toasts from OAuth callbacks
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast({
        title: `${success.toUpperCase()} connected!`,
        description: "Your account has been connected successfully.",
      });
    }
    if (error) {
      toast({
        title: "Connection failed",
        description: `Failed to connect: ${error}`,
        variant: "destructive",
      });
    }
  }, [searchParams]);

  async function loadConnections() {
    const res = await fetch("/api/platforms/list");
    if (res.ok) {
      const data = await res.json();
      setConnections(data);
    }
  }

  async function handleConnect(platformId: string, authType: string) {
    if (authType === "oauth") {
      // OAuth: get redirect URL
      setLoading(true);
      const res = await fetch(`/api/platforms/${platformId.toLowerCase()}/connect`, {
        method: "POST",
      });
      const data = await res.json();
      setLoading(false);

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: "Connection failed",
          description: data.error ?? "Could not initiate OAuth flow",
          variant: "destructive",
        });
      }
    } else {
      // Credentials: show dialog
      setConnectingPlatform(platformId);
      setCredentials({});
    }
  }

  async function handleCredentialsSubmit() {
    if (!connectingPlatform) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/platforms/${connectingPlatform.toLowerCase()}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Connection failed");
      }

      toast({
        title: `${connectingPlatform} connected!`,
        description: "Your credentials have been saved securely.",
      });
      setConnectingPlatform(null);
      loadConnections();
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(platformId: string) {
    setDisconnecting(platformId);

    const res = await fetch(
      `/api/platforms/${platformId.toLowerCase()}/connect`,
      { method: "DELETE" }
    );

    if (res.ok) {
      toast({ title: `${platformId} disconnected` });
      loadConnections();
    } else {
      toast({
        title: "Disconnect failed",
        variant: "destructive",
      });
    }

    setDisconnecting(null);
  }

  const connectedPlatforms = new Set(connections.map((c) => c.platform));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Connections</h1>
        <p className="text-slate-500">
          Connect your marketplace accounts to start posting listings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLATFORMS.map((platform) => {
          const isConnected = connectedPlatforms.has(platform.id);

          return (
            <Card
              key={platform.id}
              className={`border-2 ${isConnected ? "border-green-200 bg-green-50" : platform.color}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{platform.logo}</span>
                    <div>
                      <CardTitle className="text-lg">{platform.name}</CardTitle>
                      <CardDescription>{platform.description}</CardDescription>
                    </div>
                  </div>
                  {isConnected && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isConnected ? (
                  <div className="flex gap-2">
                    <span className="text-sm text-green-700 font-medium flex-1 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Connected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(platform.id)}
                      disabled={disconnecting === platform.id}
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {disconnecting === platform.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2Off className="h-4 w-4" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleConnect(platform.id, platform.authType)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : platform.authType === "oauth" ? (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    ) : null}
                    Connect {platform.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Credentials Dialog */}
      <Dialog
        open={!!connectingPlatform}
        onOpenChange={() => setConnectingPlatform(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect{" "}
              {PLATFORMS.find((p) => p.id === connectingPlatform)?.name}
            </DialogTitle>
            <DialogDescription>
              Your credentials are encrypted and stored securely. They are only
              used to post and search on your behalf.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="cred-email">Email</Label>
              <Input
                id="cred-email"
                type="email"
                value={credentials.email ?? ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, email: e.target.value })
                }
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-password">Password</Label>
              <Input
                id="cred-password"
                type="password"
                value={credentials.password ?? ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>
            {connectingPlatform === "CRAIGSLIST" && (
              <div className="space-y-2">
                <Label htmlFor="cred-area">Craigslist Area</Label>
                <Input
                  id="cred-area"
                  type="text"
                  value={credentials.area ?? ""}
                  onChange={(e) =>
                    setCredentials({ ...credentials, area: e.target.value })
                  }
                  placeholder="e.g. sfbay, newyork, chicago"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConnectingPlatform(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCredentialsSubmit}
                disabled={loading || !credentials.email || !credentials.password}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save & Connect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
