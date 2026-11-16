#include <stdio.h>
#include <sys/sysctl.h>

int main(void) {
    int is_vm = -1;
    size_t len = sizeof(is_vm);
    if (sysctlbyname("kern.hv_vmm_present", &is_vm, &len, NULL, 0) != 0) {
        perror("sysctlbyname(kern.hv_vmm_present)");
        return 1;
    }
    printf("kern.hv_vmm_present=%d\n", is_vm);
    return is_vm != 0;
}
