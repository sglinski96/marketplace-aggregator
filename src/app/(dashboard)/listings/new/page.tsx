"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import {
  Upload,
  Sparkles,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "VERY_GOOD", label: "Very Good" },
  { value: "GOOD", label: "Good" },
  { value: "ACCEPTABLE", label: "Acceptable" },
  { value: "FOR_PARTS", label: "For Parts / Not Working" },
];

const CATEGORIES = [
  "Electronics",
  "Clothing & Accessories",
  "Furniture",
  "Home & Garden",
  "Collectibles",
  "Sporting Goods",
  "Toys & Games",
  "Books & Media",
  "Vehicles",
  "Musical Instruments",
  "Art",
  "Jewelry",
  "Baby Items",
  "Tools",
  "Other",
];

const PLATFORMS = [
  { id: "EBAY", name: "eBay", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { id: "ETSY", name: "Etsy", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "FACEBOOK", name: "Facebook Marketplace", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "CRAIGSLIST", name: "Craigslist", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "OFFERUP", name: "OfferUp", color: "bg-green-100 text-green-800 border-green-200" },
];

export default function NewListingPage() {
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // UI state
  const [uploadingImages, setUploadingImages] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [basicInfo, setBasicInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setImages((prev) => [...prev, ...data.urls]);
      toast({ title: "Images uploaded successfully" });
    } catch {
      toast({
        title: "Upload failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingImages(false);
    }
  }

  async function handleAIGenerate() {
    if (images.length === 0) {
      toast({
        title: "Images required",
        description: "Please upload at least one image before generating.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingAI(true);

    try {
      const res = await fetch("/api/listings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, basicInfo }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }

      const generated = await res.json();

      setTitle(generated.title);
      setDescription(generated.description);
      if (generated.suggestedPrice) setPrice(String(generated.suggestedPrice));
      if (generated.category) setCategory(generated.category);
      if (generated.condition) setCondition(generated.condition.toUpperCase().replace(" ", "_"));
      if (generated.tags) setTags(generated.tags);

      toast({
        title: "Listing generated!",
        description: "Review and edit the AI-generated content below.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 13) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function togglePlatform(platformId: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  }

  async function handleSaveAndPost() {
    if (!title || !description || !price || !category) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, description, price, and category.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Save the listing
      const saveRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          category,
          condition,
          images,
          tags,
          aiGenerated: generatingAI,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error ?? "Save failed");
      }

      const listing = await saveRes.json();

      // Post to selected platforms
      if (selectedPlatforms.length > 0) {
        setPosting(true);

        const postRes = await fetch("/api/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listing.id,
            platforms: selectedPlatforms,
          }),
        });

        if (!postRes.ok) {
          const err = await postRes.json();
          toast({
            title: "Listing saved but posting failed",
            description: err.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Listing saved and queued for posting!",
            description: `Posting to ${selectedPlatforms.join(", ")}...`,
          });
        }
      } else {
        toast({ title: "Listing saved successfully!" });
      }

      router.push(`/listings/${listing.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setPosting(false);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create New Listing</h1>
        <p className="text-slate-500">
          Upload photos and let AI generate your listing
        </p>
      </div>

      {/* Step 1: Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
              1
            </span>
            Photos
          </CardTitle>
          <CardDescription>
            Upload up to 12 photos. Clear photos lead to better AI descriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {images.map((url, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 12 && (
              <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center cursor-pointer transition-colors">
                {uploadingImages ? (
                  <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-400">Add photo</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploadingImages}
                />
              </label>
            )}
          </div>

          {/* AI Generation */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-slate-800 mb-1">
                  AI Listing Generator
                </h4>
                <p className="text-sm text-slate-600 mb-3">
                  Optionally add context (brand, notes) to help Claude write a
                  better listing.
                </p>
                <Input
                  placeholder="e.g. Sony PlayStation 5, barely used, all cables included"
                  value={basicInfo}
                  onChange={(e) => setBasicInfo(e.target.value)}
                  className="mb-3 bg-white"
                />
                <Button
                  onClick={handleAIGenerate}
                  disabled={generatingAI || images.length === 0}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  {generatingAI ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generatingAI ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Listing Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
              2
            </span>
            Listing Details
          </CardTitle>
          <CardDescription>
            Review and edit your listing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-slate-400 text-xs">({title.length}/80)</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="What are you selling?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item in detail..."
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags (up to 13)</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                disabled={tags.length >= 13}
              />
              <Button onClick={addTag} variant="outline" size="sm" disabled={tags.length >= 13}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
              3
            </span>
            Select Platforms
          </CardTitle>
          <CardDescription>
            Choose where to post your listing. Requires connected accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLATFORMS.map((platform) => {
              const selected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="font-medium text-sm">{platform.name}</span>
                  {selected ? (
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-300" />
                  )}
                </button>
              );
            })}
          </div>
          {selectedPlatforms.length > 0 && (
            <p className="text-sm text-slate-500 mt-3 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Make sure your accounts are connected in{" "}
              <a href="/platforms" className="text-blue-600 underline">
                Platform Settings
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save & Post */}
      <div className="flex gap-3 pb-8">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={handleSaveAndPost}
          disabled={saving || posting}
          className="gap-2 flex-1 sm:flex-none"
        >
          {saving || posting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {posting
            ? "Posting..."
            : saving
            ? "Saving..."
            : selectedPlatforms.length > 0
            ? `Save & Post to ${selectedPlatforms.length} Platform${selectedPlatforms.length > 1 ? "s" : ""}`
            : "Save Listing"}
        </Button>
      </div>
    </div>
  );
}
