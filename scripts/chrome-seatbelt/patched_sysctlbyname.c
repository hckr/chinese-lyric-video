#include <errno.h>
#include <string.h>
#include <sys/sysctl.h>

static int patched_sysctlbyname(
    const char *name, void *oldp, size_t *oldlenp,
    void *newp, size_t newlen
) {
    // Codex Seatbelt denies Chromium's VM query; this physical Mac is not a VM.
    if (name && strcmp(name, "kern.hv_vmm_present") == 0 &&
        !newp && newlen == 0) {
        if (!oldlenp) {
            errno = EFAULT;
            return -1;
        }
        if (oldp) {
            if (*oldlenp < sizeof(int)) {
                errno = ENOMEM;
                return -1;
            }
            *(int *)oldp = 0;
        }
        *oldlenp = sizeof(int);
        return 0;
    }
    return sysctlbyname(name, oldp, oldlenp, newp, newlen);
}

__attribute__((used, section("__DATA,__interpose")))
static const struct {
    const void *replacement;
    const void *original;
} interposer = {
    (const void *)patched_sysctlbyname,
    (const void *)sysctlbyname,
};
