/* Original allstudio helper. Directory-relative operations never follow symlinks.
 * The granting parent must pass its pinned root directory as descriptor 3.
 * Protocol: argv read|write root relative; writes receive length\nbytes twice
 * (expected and replacement). READY precedes input; PREPARED waits for C to
 * commit. Output ends with OK [mode length]\n[bytes] or ERR reason.
 */
#define _DARWIN_C_SOURCE
#define _GNU_SOURCE
#include <errno.h>
#include <dirent.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <sys/stat.h>
#include <unistd.h>
#if defined(__linux__)
#include <linux/fs.h>
#include <sys/syscall.h>
#endif

#define LIMIT (1024 * 1024)
static int parent_fd = -1;
static char temp_name[80];
static int published;
static int owns_temp;
static struct stat owned_temp;
static void fail(const char *reason) {
  struct stat visible;
  if (owns_temp && parent_fd >= 0 && temp_name[0] &&
      !fstatat(parent_fd, temp_name, &visible, AT_SYMLINK_NOFOLLOW) &&
      visible.st_dev == owned_temp.st_dev && visible.st_ino == owned_temp.st_ino)
    unlinkat(parent_fd, temp_name, 0);
  printf("ERR %s\n", published ? "commit-uncertain" : reason);
  exit(1);
}
static char *receive(size_t *length) {
  char header[32], *end;
  if (!fgets(header, sizeof(header), stdin)) fail("invalid-request");
  errno = 0;
  unsigned long size = strtoul(header, &end, 10);
  if (errno || *end != '\n' || end == header || size > LIMIT) fail("invalid-request");
  char *bytes = malloc(size + 1);
  if (!bytes || fread(bytes, 1, size, stdin) != size) fail("invalid-request");
  *length = size;
  return bytes;
}
static char *read_source(int fd, size_t *length, struct stat *metadata) {
  if (fstat(fd, metadata) || !S_ISREG(metadata->st_mode) || metadata->st_nlink != 1 ||
      metadata->st_size < 0 || metadata->st_size > LIMIT) fail("path-rejected");
  *length = (size_t)metadata->st_size;
  char *bytes = malloc(*length + 1);
  if (!bytes || lseek(fd, 0, SEEK_SET) < 0) fail("read-failed");
  size_t offset = 0;
  while (offset < *length) {
    ssize_t count = read(fd, bytes + offset, *length - offset);
    if (count <= 0) fail("read-failed");
    offset += (size_t)count;
  }
  char extra;
  if (read(fd, &extra, 1) != 0) fail("stale-file");
  return bytes;
}
static int same_inode(const struct stat *a, const struct stat *b) {
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino;
}
static void verify(int fd, const char *name, const struct stat *original,
                   const char *expected, size_t expected_size) {
  struct stat entry, current;
  if (fstatat(parent_fd, name, &entry, AT_SYMLINK_NOFOLLOW) ||
      !S_ISREG(entry.st_mode) || entry.st_nlink != 1 ||
      (entry.st_mode & 07777) != (original->st_mode & 07777) || !same_inode(original, &entry)) fail("stale-file");
  size_t size;
  char *bytes = read_source(fd, &size, &current);
  if (!same_inode(original, &current) ||
      (current.st_mode & 07777) != (original->st_mode & 07777) || size != expected_size || memcmp(bytes, expected, size)) fail("stale-file");
  free(bytes);
}
static void verify_parent(const char *root, const char *relative) {
  (void)root;
  int current = dup(3);
  if (current < 0) fail("path-rejected");
  char *path = strdup(relative), *part = path;
  if (!path) fail("read-failed");
  char *slash;
  while ((slash = strchr(part, '/'))) {
    *slash = '\0';
    int next = openat(current, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    close(current);
    if (next < 0) fail("path-rejected");
    current = next;
    part = slash + 1;
  }
  struct stat original, visible;
  if (fstat(parent_fd, &original) || fstat(current, &visible) || !same_inode(&original, &visible)) fail("path-rejected");
  close(current);
  free(path);
}
static unsigned visited, listed;
static void list_source(int directory, const char *prefix, unsigned depth) {
  if (depth > 32) fail("scan-limit");
  DIR *stream = fdopendir(dup(directory));
  if (!stream) fail("read-failed");
  struct dirent *entry;
  while ((entry = readdir(stream))) {
    if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
    if (++visited > 10000) fail("scan-limit");
    if (!strcmp(entry->d_name, "node_modules") || !strcmp(entry->d_name, ".git") || !strcmp(entry->d_name, ".next")) continue;
    char relative[1025];
    int length = snprintf(relative, sizeof(relative), "%s/%s", prefix, entry->d_name);
    if (length < 0 || (size_t)length >= sizeof(relative)) continue;
    struct stat info;
    if (fstatat(directory, entry->d_name, &info, AT_SYMLINK_NOFOLLOW)) continue;
    if (S_ISDIR(info.st_mode)) {
      int child = openat(directory, entry->d_name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
      if (child >= 0) { list_source(child, relative, depth + 1); close(child); }
    } else if (S_ISREG(info.st_mode) && info.st_nlink == 1 && info.st_size <= LIMIT && length >= 9 &&
               (!strcmp(relative + length - 4, ".tsx") || !strcmp(relative + length - 4, ".jsx"))) {
      if (++listed > 1000) fail("scan-limit");
      printf("%d\n", length);
      if (fwrite(relative, 1, (size_t)length, stdout) != (size_t)length) fail("read-failed");
    }
  }
  closedir(stream);
}
static int configuration(const char *path) {
  return !strcmp(path, "next.config.ts") || !strcmp(path, "next.config.js") || !strcmp(path, "next.config.mjs");
}
static int readable_root(const char *path) {
  const char *names[] = { "package.json", "bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.json", "jsconfig.json", "next.config.allstudio-original.ts", "next.config.allstudio-original.js", "next.config.allstudio-original.mjs", "postcss.config.js", "postcss.config.mjs", "postcss.config.cjs", "tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "postcss.config.ts", "babel.config.js", "babel.config.cjs", "babel.config.mjs", ".babelrc", ".babelrc.json", ".swcrc", NULL };
  for (unsigned i = 0; names[i]; ++i) if (!strcmp(path, names[i])) return 1;
  return configuration(path);
}
int main(int argc, char **argv) {
  if (argc != 4 || (strcmp(argv[1], "read") && strcmp(argv[1], "write") && strcmp(argv[1], "list") && strcmp(argv[1], "backup") && strcmp(argv[1], "create"))) fail("invalid-request");
  const char *root = argv[2], *relative = argv[3];
  size_t length = strlen(relative);
  int listing = !strcmp(argv[1], "list") && !strcmp(relative, "src");
  int creating = !strcmp(argv[1], "create") && configuration(relative);
  int backing = !strcmp(argv[1], "backup") && configuration(relative);
  int config_io = configuration(relative) && (!strcmp(argv[1], "read") || !strcmp(argv[1], "write"));
  int metadata_read = !strcmp(argv[1], "read") && readable_root(relative);
  int source_path = length <= 1024 && length >= 9 && !strncmp(relative, "src/", 4) &&
      !strchr(relative, '\\') && !strchr(relative, ':') &&
      (!strcmp(relative + length - 4, ".tsx") || !strcmp(relative + length - 4, ".jsx"));
  if (!listing && !creating && !backing && !config_io && !metadata_read && !source_path) fail("path-rejected");
  if ((!strcmp(argv[1], "create") && !creating) || (!strcmp(argv[1], "backup") && !backing)) fail("path-rejected");
  char *canonical = realpath(root, NULL);
  if (!canonical || strcmp(canonical, root)) fail("path-rejected");
  free(canonical);
  struct stat granted, visible;
  if (fstat(3, &granted) || !S_ISDIR(granted.st_mode) || stat(root, &visible) || !same_inode(&granted, &visible)) fail("path-rejected");
  if (listing) {
    int source = openat(3, "src", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (source < 0) fail("path-rejected");
    puts("OK");
    list_source(source, "src", 0);
    return 0;
  }
  parent_fd = dup(3);
  if (parent_fd < 0) fail("path-rejected");
  char *path = strdup(relative), *component = path;
  if (!path) fail("read-failed");
  for (;;) {
    char *slash = strchr(component, '/');
    if (slash) *slash = '\0';
    if (!*component || !strcmp(component, ".") || !strcmp(component, "..")) fail("path-rejected");
    if (!slash) break;
    int next = openat(parent_fd, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) fail("path-rejected");
    close(parent_fd);
    parent_fd = next;
    component = slash + 1;
  }
  int fd = -1;
  struct stat metadata = {0};
  size_t size = 0;
  char *original = NULL;
  if (creating) {
    struct stat existing;
    if (!fstatat(parent_fd, component, &existing, AT_SYMLINK_NOFOLLOW) || errno != ENOENT) fail("path-rejected");
    metadata.st_mode = 0644;
  } else {
    fd = openat(parent_fd, component, O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC);
    if (fd < 0) fail(errno == ENOENT ? "file-not-found" : "path-rejected");
    original = read_source(fd, &size, &metadata);
  }
  if (!strcmp(argv[1], "read")) {
    printf("OK %u %zu\n", (unsigned)(metadata.st_mode & 07777), size);
    if (fwrite(original, 1, size, stdout) != size) fail("read-failed");
    return 0;
  }
  puts("READY");
  fflush(stdout);
  size_t expected_size, replacement_size;
  char *expected = receive(&expected_size);
  char *replacement = receive(&replacement_size);
  if (size != expected_size || (size && memcmp(original, expected, size))) fail("stale-file");
  verify_parent(root, relative);
  if (!creating) verify(fd, component, &metadata, expected, expected_size);
  if (backing && (replacement_size != size || memcmp(original, replacement, size))) fail("invalid-request");
  uint64_t random;
  if (getentropy(&random, sizeof(random))) fail("write-failed");
  snprintf(temp_name, sizeof(temp_name), ".allstudio-%016llx.tmp", (unsigned long long)random);
  int temp = openat(parent_fd, temp_name, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (temp < 0) { temp_name[0] = '\0'; fail("write-failed"); }
  if (fstat(temp, &owned_temp)) fail("write-failed");
  owns_temp = 1;
  size_t offset = 0;
  while (offset < replacement_size) {
    ssize_t written = write(temp, replacement + offset, replacement_size - offset);
    if (written <= 0) fail("write-failed");
    offset += (size_t)written;
  }
  if (fchmod(temp, metadata.st_mode & 07777) || fsync(temp)) fail("write-failed");
  struct stat prepared;
  if (fstat(temp, &prepared)) fail("write-failed");
  puts("PREPARED");
  fflush(stdout);
  if (getchar() != 'C') fail("write-failed");
  verify_parent(root, relative);
  if (!creating) verify(fd, component, &metadata, expected, expected_size);
  verify(temp, temp_name, &prepared, replacement, replacement_size);
  char backup_name[80];
  const char *target = component;
  if (backing) {
    snprintf(backup_name, sizeof(backup_name), "next.config.allstudio-original%s", strrchr(component, '.'));
    target = backup_name;
  }
  if (creating || backing) {
#if defined(__APPLE__)
    if (renameatx_np(parent_fd, temp_name, parent_fd, target, RENAME_EXCL)) fail("write-failed");
#elif defined(__linux__)
    if (syscall(SYS_renameat2, parent_fd, temp_name, parent_fd, target, RENAME_NOREPLACE)) fail("write-failed");
#else
#error Unsupported native platform
#endif
    published = 1;
  } else {
    if (renameat(parent_fd, temp_name, parent_fd, target)) fail("write-failed");
    published = 1;
  }
  temp_name[0] = '\0';
  verify(temp, target, &prepared, replacement, replacement_size);
  if (close(temp)) fail("durability-unknown");
  if (fsync(parent_fd)) fail("durability-unknown");
  puts("OK");
  return 0;
}
